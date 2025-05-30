const puppeteer = require("puppeteer");
// const { HttpsProxyAgent } = require("https-proxy-agent");

// const fs = require("fs");
// const path = require("path");

// Get the command-line arguments excluding the first two (node and script path)
const args = process.argv.slice(2);

// Check if the '--dev' flag exists in the arguments
const DEV_MODE = args.includes("--dev");

//use when you dont want the browser to close and if you only want the first engine url
const SINGLE_MODE = args.includes("--single");

//use when you want to debug and not upload the files to s3
// const --noaws = args.includes("--noaws");

// Output the value of DEV_MODE for verification
console.log(`DEV_MODE is set to: ${DEV_MODE}`);

(async () => {
  // Initialize puppeteerConfig with either development or production settings
  const puppeteerConfig = {
    headless: !DEV_MODE,
    slowMo: 100,
    args: [
      "--no-sandbox",
      ...(!DEV_MODE
        ? ["--disable-gpu", "--single-process", "--no-zygote"]
        : []),
    ],
  };
  // Launch a headless browser with Puppeteer
  const browser = await puppeteer.launch(puppeteerConfig);

  // Open a new browser page and set the user-agent
  const page = await browser.newPage();

  // await page.authenticate({ username, password });

  await page.setUserAgent(
    "Mozilla/5.0 (Linux; Android 12; Pixel 4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Mobile Safari/537.36"
  );

  await page.goto("https://www.congress.gov/members/find-your-member", {
    waitUntil: "networkidle2",
  });

  await page.waitForSelector("#search-widget-input");
  console.log("found");
  await page.type("#search-widget-input", '33771', { delay: 100 });
  // await page.click('#search-widget button');
  // await page.keyboard.press("Enter"); // Simulate pressing the Enter key
  // await page.waitForNavigation();

  await Promise.all([
    // Wait for navigation to the new page, consider network idle
    page.keyboard.press('Enter'),
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
  ]);
  
  // Wait for the list to appear
  await page.waitForSelector("ol#outputMessages li");

  console.log("fount output messages");

  // Extract the data and format it as JSON
  const results = await page.$$eval("#outputMessages li.expanded", (reps) => {
    console.log({reps})
    return reps.map((rep) => {
      console.log({rep})
      const resultData = {};
      resultData['name'] = rep.querySelector('.result-heading').textContent.trim()
      
      const rep_results = rep.querySelectorAll(".result-item");
      console.log({rep_results})

      rep_results.forEach((resultItem) => {
        
        const member_data = resultItem.querySelectorAll('.member-served li') ?? []
        if(member_data.length){
          member_data.forEach((data, index) => {
            if(index == 1){
              resultData['phone'] = data.textContent.trim()
            }
            if(index == 2){
              resultData['contact'] = data.querySelector('a').href
            }
          })
          return
        }
        const keyElement = resultItem.querySelector("strong");
        const valueElement = resultItem.querySelector("span");

        if (keyElement && valueElement) {
          const key = keyElement.textContent.replace(":", "").trim();
          const value = valueElement.textContent.trim();
          resultData[key.toLowerCase()] = value;
        }
      });
      return resultData
    });
  });

  console.log(JSON.stringify(results, null, 2));

  await browser.close()

  return results
  
  // process.exit()
})();
