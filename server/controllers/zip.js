const puppeteer = require("puppeteer");
// const express = require("express");

const zipRouter = require("express").Router();
const db = require("../src/utils/db"); // Import the db module

// The function that performs the Puppeteer operations
const fetchCongressData = async (zipCode, devMode = false) => {
  const puppeteerConfig = {
    headless: !devMode,
    slowMo: 100,
    args: [
      "--no-sandbox",
      ...(!devMode ? ["--disable-gpu", "--single-process", "--no-zygote"] : []),
    ],
  };
  const browser = await puppeteer.launch(puppeteerConfig);
  let results = []
  try {
    const page = await browser.newPage();


    await page.setUserAgent(
      "Mozilla/5.0 (Linux; Android 12; Pixel 4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Mobile Safari/537.36"
    );

    console.log("Puppateer Init Complete");
    console.log("got to zip code page");
    await page.goto("https://www.congress.gov/members/find-your-member", {
      waitUntil: "networkidle2",
      timeout: 90000, // 90 seconds timeout
    });

    await page.waitForSelector("#search-widget-input", { timeout: 90000 });
    await page.type("#search-widget-input", zipCode, { delay: 100 });

    console.log("entered zip");
    console.log("go to results page");
    await Promise.all([
      page.keyboard.press("Enter"),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 90000 }),
    ]);
    console.log("onresults page");

    console.log("wait for results list");
    await page.waitForSelector("ol#outputMessages li", { timeout: 90000 });

    console.log("eval results");
    results = await page.$$eval("#outputMessages li.expanded", (reps) => {
      return reps.map((rep) => {
        const resultData = {};
        const repName = rep.querySelector(".result-heading").textContent.trim();
        const repNameTypeParts = repName.split(" ");
        resultData["type"] = repNameTypeParts.shift();
        const nameParts = repNameTypeParts.join(" ").split(",");
        resultData["name"] = `${nameParts[1].trim()} ${nameParts[0].trim()}`;

        // resultData['name'] = rep.querySelector('.result-heading').textContent.trim();

        const rep_results = rep.querySelectorAll(".result-item");
        rep_results.forEach((resultItem) => {
          const member_data =
            resultItem.querySelectorAll(".member-served li") ?? [];
          if (member_data.length) {
            member_data.forEach((data, index) => {
              if (index === 1) {
                resultData["phone"] = data.textContent.trim();
              }
              if (index === 2) {
                resultData["contact"] = data.querySelector("a").href;
              }
            });
            return;
          }
          const keyElement = resultItem.querySelector("strong");
          const valueElement = resultItem.querySelector("span");

          if (keyElement && valueElement) {
            const key = keyElement.textContent.replace(":", "").trim();
            const value = valueElement.textContent.trim();
            resultData[key.toLowerCase()] = value;
          }
        });
        return resultData;
      });
    });
    console.log({results})
  } catch (e) {
    console.error('data fetch error', e)
    results = null
  }
  finally{
    
    console.log("close browser");
    await browser.close();
  }

  console.log("return results");

  return results;
};

// The Express route handler
zipRouter.get("/", async (req, res) => {
  try {
    const zip = req.query.zip;
    const devMode = req.query.dev === "true";

    if (!zip) {
      return res.status(400).json({ error: "ZIP code is required." });
    }

    const zipRegex = /^\d{5}$/;
    if (!zipRegex.test(zip)) {
      return res.status(400).json({
        error: "Invalid ZIP code format. It should be a 5-digit number.",
      });
    }

    const connection = await db.getConnection();

    try {
      // Check if the response is already cached
      const rows = await connection.query(
        "SELECT response FROM cache WHERE zip = ?",
        [zip]
      );
      console.log({ rows });
      if (rows.length > 0) {
        console.log("cache hit");
        return res.status(200).json(JSON.parse(rows[0].response));
      }
      console.log("cache miss");

      // Call the fetchCongressData function and get results
      const results = await fetchCongressData(zip, devMode);
      if(results == null){
        throw new Error('No results')
      }

      // Cache the response in the database
      await connection.query(
        "INSERT INTO cache (zip, response) VALUES (?, ?)",
        [zip, JSON.stringify(results)]
      );

      res.status(200).json(results);
    } finally {
      connection.release(); // Ensure the connection is released back to the pool
    }

    // Call the fetchCongressData function and return results as JSON
    // const results = await fetchCongressData(zip, devMode);
    // res.status(200).json(results);
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = zipRouter;
