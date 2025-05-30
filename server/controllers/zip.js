const puppeteer = require("puppeteer");
// const express = require("express");

const zipRouter = require("express").Router();

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
  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Linux; Android 12; Pixel 4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Mobile Safari/537.36"
  );

  await page.goto("https://www.congress.gov/members/find-your-member", {
    waitUntil: "networkidle2",
  });

  await page.waitForSelector("#search-widget-input");
  await page.type("#search-widget-input", zipCode, { delay: 100 });

  await Promise.all([
    page.keyboard.press('Enter'),
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
  ]);

  await page.waitForSelector("ol#outputMessages li");

  const results = await page.$$eval("#outputMessages li.expanded", (reps) => {
    return reps.map((rep) => {
      const resultData = {};
      resultData['name'] = rep.querySelector('.result-heading').textContent.trim();

      const rep_results = rep.querySelectorAll(".result-item");
      rep_results.forEach((resultItem) => {
        const member_data = resultItem.querySelectorAll('.member-served li') ?? [];
        if (member_data.length) {
          member_data.forEach((data, index) => {
            if (index === 1) {
              resultData['phone'] = data.textContent.trim();
            }
            if (index === 2) {
              resultData['contact'] = data.querySelector('a').href;
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

  await browser.close();
  return results;
};

// The Express route handler
zipRouter.get("/", async (req, res) => {
  try {
    const zip = req.query.zip;
    const devMode = req.query.dev === 'true';

    if (!zip) {
      return res.status(400).json({ error: "ZIP code is required." });
    }

    const zipRegex = /^\d{5}$/;
    if (!zipRegex.test(zip)) {
      return res.status(400).json({ error: "Invalid ZIP code format. It should be a 5-digit number." });
    }

    // Call the fetchCongressData function and return results as JSON
    const results = await fetchCongressData(zip, devMode);
    res.status(200).json(results);
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = zipRouter;