const puppeteer = require("puppeteer");
const fs = require("fs");
const pool = require("./src/utils/db");
const path = require("path");
const AWS = require("aws-sdk");
const archiver = require("archiver");
const {
  searchEnginesNews,
  searchEnginesGeneral,
} = require("./src/engineUrlConfig");

let aws_info;
try {
  aws_info = require(path.join(__dirname, "./secrets/aws_secrets.json"));
} catch (e) {
  console.log("error loading aws secrets");
  console.error(e);
  return null;
}

//configure the keys for accessing AWS
AWS.config.update({
  accessKeyId: aws_info.AWS_KEY,
  secretAccessKey: aws_info.AWS_SECRET_KEY,
  region: "us-east-1",
});
const s3 = new AWS.S3();

const generalUA =
  "Mozilla/5.0 (Linux; Android 12; Pixel 4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Mobile Safari/537.36";
const userAgents = {
  Chromium:
    "Mozilla/5.0 (Linux; Android 12; Pixel 4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Mobile Safari/537.36",
  Firefox:
    "Mozilla/5.0 (Android 12; Mobile; rv:105.0) Gecko/105.0 Firefox/105.0",
  Edge: "Mozilla/5.0 (Linux; Android 12; Pixel 4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Mobile Safari/537.36 EdgA/105.0.1343.50",
};
// const userAgents = {
//     Chromium: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36',
//     Firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:105.0) Gecko/20100101 Firefox/105.0',
//     Edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36 Edg/105.0.1343.53 ',
// }

const searchJson = "brianSearch.json";
const outputDirectory = "general_tab_exports_state_races";

// const searchInfo = require(`./${searchJson}`)
// const searchInfo = require('./governorSearch.json')
// console.log(searchInfo)

// let searchIndex = searchInfo.currTerm
// if (searchIndex == 0) {
//     // process.exit()
// }
// const searchTerms = searchInfo.searchTerms

//taken from https://stackoverflow.com/a/51518100/18951345
/**
 * @param {String} sourceDir: /some/folder/to/compress
 * @param {String} outPath: /path/to/created.zip
 * @returns {Promise}
 */
function zipDirectory(sourceDir, outPath) {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const stream = fs.createWriteStream(outPath);

  return new Promise((resolve, reject) => {
    archive
      .directory(sourceDir, false)
      .on("error", (err) => reject(err))
      .pipe(stream);

    stream.on("close", () => resolve());
    archive.finalize();
  });
}
const keyToLabel = (key) => {
  if (key == "google") return "Google";
  if (key == "bing") return "Bing";
  if (key == "brave") return "Brave";
  if (key == "duck") return "Duck Duck Go";
  return null;
};

const normalizeString = (term) => {
  let ret = term.toLowerCase();
  return ret.replace(/[^a-zA-Z\d]/g, "+");
};
const stripQuotes = (title) => {
  // Check if the title is a string
  if (typeof title === "string") {
    return title.replace(/\"/g, "'");
  } else {
    // If title is not a string, throw an error or return a default value, e.g., an empty string
    // throw new Error('The input title is not a string.');
    return ""; // Return an empty string as a default, or choose another appropriate default value
  }
};
// const stripQuotes = title => {
//     return title.replace(/\"/g, "'")
// }
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      var totalHeight = 0;
      var distance = 100;
      var timer = setInterval(() => {
        console.log("scrolling...");
        var scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        console.log({
          totalHeight,
          scrollHeight,
          "window.innerHeight": window.innerHeight,
        });

        if (totalHeight >= scrollHeight - window.innerHeight) {
          console.log("true");
          clearInterval(timer);
          resolve();
        }
      }, 20);
    });
  });
}
async function autoScrollDiv(page, selector) {
  await page.evaluate(async (selector) => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const scrollInterval = 100; // ms, increased interval for better handling of heavy pages

      // Get the element to scroll
      const scrollableElement = document.querySelector(selector);
      if (!scrollableElement) {
        console.error(`Element with selector "${selector}" not found.`);
        resolve();
        return;
      }

      const scrollFunction = () => {
        const scrollHeight = scrollableElement.scrollHeight;
        const clientHeight = scrollableElement.clientHeight;
        scrollableElement.scrollBy(0, distance);
        totalHeight += distance;

        console.log({
          totalHeight,
          scrollHeight,
          clientHeight,
          "scrollableElement.scrollTop": scrollableElement.scrollTop,
        });

        if (totalHeight + clientHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      };

      const timer = setInterval(scrollFunction, scrollInterval);

      // Make sure to clear the interval in case the div does not need all the scrolls
      setTimeout(() => {
        clearInterval(timer);
        resolve();
      }, 30000); // Safety timeout after 30 seconds
    });
  }, selector);
}
async function googleMoreResultsBtn(page) {
  console.log("one more autoscroll");
  await autoScroll(page);
  // Wait for the page to load (you may need to adjust this based on your specific page's load time)
  console.log("wait for selector");
  await page.waitForSelector('a[aria-label="More search results"]', {
    visible: true,
  });

  // Click the element
  console.log("cliick");
  await page.click('a[aria-label="More search results"]');

  //   // Add some delay to observe the click effect
  //   console.log("wait 3000");
  //   await page.waitForTimeout(3000);
}
async function tuskMoreResultsBtn(page) {
  console.log("one more autoscroll");
  await page.waitForSelector(".search-results-infinite-scroll");
  await autoScrollDiv(page, ".search-results-infinite-scroll");

  // Wait for the page to load (you may need to adjust this based on your specific page's load time)
  try {
    console.log("wait for selector");
    await page.waitForSelector("button.btn-more-results", {
      visible: true,
    });
  } catch (e) {
    //scroll again
    console.log("scroll again");
    await autoScrollDiv(page, ".search-results-infinite-scroll");
    console.log("wait for selector part duex");
    await page.waitForSelector("button.btn-more-results", {
      visible: true,
    });
  }

  // Click the element
  console.log("cliick");
  await page.click("button.btn-more-results");

  //   // Add some delay to observe the click effect
  //   console.log("wait 3000");
  //   await page.waitForTimeout(3000);
}
async function bingMoreResultsBtn(page) {
  console.log("one more autoscroll");
  await autoScroll(page);
  // Wait for the page to load (you may need to adjust this based on your specific page's load time)
  console.log("wait for selector");
  await page.waitForSelector('a[title="Next page"]', {
    visible: true,
  });

  // Click the element
  console.log("cliick");
  await page.click('a[title="Next page"]');

  //   // Add some delay to observe the click effect
  //   console.log("wait 3000");
  //   await page.waitForTimeout(3000);
}
async function duckMoreResultsBtn(page) {
  console.log("one more autoscroll");
  await autoScroll(page);
  // Wait for the page to load (you may need to adjust this based on your specific page's load time)
  console.log("wait for selector");
  await page.waitForSelector("#more-results", {
    visible: true,
  });

  // Click the element
  console.log("cliick");
  await page.click("#more-results");

  //   // Add some delay to observe the click effect
  //   console.log("wait 3000");
  //   await page.waitForTimeout(3000);
}
const extractLinks = async (engine, page, screenshotFilePath, fileName) => {
  if (engine == "google") {
    await autoScroll(page);
    await autoScroll(page);
    await autoScroll(page);
    await autoScroll(page);
    const extraPages = 5;
    for (let i = 0; i < extraPages; ++i) {
      await googleMoreResultsBtn(page);
    }
    const gCards = await page.$$eval("div[data-snc]", (cards) => {
      return cards.map((card) => {
        const heading = card.querySelector('div[role="heading"]');
        let link = card.querySelector("a")?.href;
        if (heading && link) {
          let text = heading.textContent;
          return { link, text };
        }
      });
    });

    console.log("screenshot...");
    await pageScreenshot(page, screenshotFilePath, fileName, null);

    return gCards.filter((elem) => elem != null);
  }
  if (engine == "bing") {
    await page.waitForSelector(".b_algoheader");

    const allCards = [];

    const pages = 5;

    for (let i = 0; i < pages; ++i) {
      await autoScroll(page);
      await autoScroll(page);
      await autoScroll(page);
      const Cards = await page.$$eval(".b_algoheader", (cards) => {
        return cards.map((card) => {
          let link = card.querySelector("a").href;
          let text = card.querySelector("h2").innerText;
          return { link, text };
        });
      });
      allCards.push(...Cards.filter((elem) => elem != null));
      console.log("screenshot...");
      await pageScreenshot(page, screenshotFilePath, fileName, i + 1);

      await bingMoreResultsBtn(page);
    }

    return allCards;
  }
  if (engine == "brave") {
    await autoScroll(page);
    await autoScroll(page);

    const braveCards = await page.$$eval(
      ".result-header .snippet-title",
      (cards) => {
        return cards.map((card) => {
          const text = card.innerText;
          let currNode = card.parentNode;
          while (currNode.tagName !== "A") {
            currNode = currNode.parentNode;
          }
          const link = currNode.href;
          return { link, text };
        });
      }
    );

    console.log("screenshot...");
    await pageScreenshot(page, screenshotFilePath, fileName, null);

    return braveCards.filter((elem) => elem != null);
  }
  if (engine == "tusk") {
    await page.waitForSelector(".result-card");

    // await autoScrollDiv(page, ".search-results-infinite-scroll");
    // await autoScrollDiv(page, ".search-results-infinite-scroll");
    // await autoScrollDiv(page, ".search-results-infinite-scroll");
    // await autoScrollDiv(page, ".search-results-infinite-scroll");
    // console.log("wait 3000");
    // await page.waitForTimeout(3000);

    // console.log("fucl autpscroll?");
    const extraPages = 4;
    for (let i = 0; i < extraPages; ++i) {
      await tuskMoreResultsBtn(page);
    }

    const tuskCards = await page.$$eval(".result-card a.title", (cards) => {
      return cards.map((card) => {
        const text = card.innerText;
        const link = card.href;
        return { link, text };
      });
    });

    console.log("screenshot...");
    await pageScreenshot(
      page,
      screenshotFilePath,
      fileName,
      null,
      ".search-results-infinite-scroll"
    );

    return tuskCards.filter((elem) => elem != null);
  }

  if (engine == "duck") {
    await autoScroll(page);
    const extraPages = 2;
    for (let i = 0; i < extraPages; ++i) {
      await duckMoreResultsBtn(page);
    }
    const duckCards = await page.$$eval(
      ".react-results--main h2 a",
      (cards) => {
        return cards.map((card) => {
          const link = card.href;
          const text = card.innerText;
          return { link, text };
        });
      }
    );

    console.log("screenshot...");
    await pageScreenshot(page, screenshotFilePath, fileName, null);

    return duckCards.filter((elem) => elem != null);
  }

  return;
};
const extractNewsLinks = async (engine, page, screenshotFilePath, fileName) => {
  if (engine == "google") {
    await autoScroll(page);
    await autoScroll(page);
    const gCards = await page.$$eval("a[jsname]", (cards) => {
      return cards.map((card) => {
        const heading = card.querySelector('div[role="heading"]');
        let link = card?.href;
        if (heading && link) {
          let text = heading.textContent;
          return { link, text };
        }
      });
    });

    console.log("screenshot...");
    await pageScreenshot(page, screenshotFilePath, fileName, null);

    return gCards.filter((elem) => elem != null);
  }
  if (engine == "bing") {
    await page.waitForSelector(".newscard");

    await autoScroll(page);
    await autoScroll(page);
    await autoScroll(page);

    const Cards = await page.$$eval(".newscard", (cards) => {
      return cards.map((card) => {
        // console.log(card)
        let link = card.getAttribute("data-url");
        let text = card.getAttribute("data-title");
        // let link = card.querySelector("a").href;
        // let text = card.querySelector("h2").innerText;
        return { link, text };
      });
    });

    console.log("screenshot...");
    await pageScreenshot(page, screenshotFilePath, fileName, null);

    return Cards.filter((elem) => elem != null);
  }
  if (engine == "brave") {
    await autoScroll(page);
    await autoScroll(page);

    const braveCards = await page.$$eval(
      ".result-header .snippet-title",
      (cards) => {
        return cards.map((card) => {
          const text = card.innerText;
          let currNode = card.parentNode;
          while (currNode.tagName !== "A") {
            currNode = currNode.parentNode;
          }
          const link = currNode.href;
          return { link, text };
        });
      }
    );

    console.log("screenshot...");
    await pageScreenshot(page, screenshotFilePath, fileName, null);

    return braveCards.filter((elem) => elem != null);
  }
  if (engine == "tusk") {
    await page.waitForSelector(".result-card");
    await autoScroll(page);
    await autoScroll(page);

    const tuskCards = await page.$$eval(".result-card a.title", (cards) => {
      return cards.map((card) => {
        const text = card.innerText;
        const link = card.href;
        return { link, text };
      });
    });

    console.log("screenshot...");
    await pageScreenshot(page, screenshotFilePath, fileName, null);

    return tuskCards.filter((elem) => elem != null);
  }

  if (engine == "duck") {
    await autoScroll(page);
    await autoScroll(page);
    const duckCards = await page.$$eval(
      ".result--news h2 .result__a",
      (cards) => {
        return cards.map((card) => {
          const link = card.href;
          const text = card.innerText;
          return { link, text };
        });
      }
    );

    console.log("screenshot...");
    await pageScreenshot(page, screenshotFilePath, fileName, null);

    return duckCards.filter((elem) => elem != null);
  }

  return;
};

console.log("screenshot...");
const pageScreenshot = async (
  page,
  screenshotFilePath,
  fileName,
  pagenum = null,
  selector = null
) => {
  const screenshotFileName = `${screenshotFilePath}${fileName}`;

  const path = pagenum
    ? `${screenshotFileName}_page_${pagenum}.png`
    : `${screenshotFileName}.png`;

  try {
    if (typeof selector === "string" && selector.length) {
      // Select the element
      const element = await page.$(selector);

      // Take a screenshot of the element
      await element.screenshot({
        path,
        // captureBeyondViewport: true,
        // fullPage: true,
      });
    } else {
      await page.screenshot({
        path,
        fullPage: true,
        captureBeyondViewport: true,
      });
    }
  } catch (err) {
    fs.mkdirSync(screenshotFilePath, { recursive: true });
    if (typeof selector === "string" && selector.length) {
      // Select the element
      const element = await page.$(selector);

      // Take a screenshot of the element
      await element.screenshot({
        path,
        captureBeyondViewport: true,
        // fullPage: true,
      });
    } else {
      await page.screenshot({
        path,
        fullPage: true,
        captureBeyondViewport: true,
      });
    }
  }
};

(async () => {
  // let term = searchTerms[searchIndex]
  let conn;
  let resp;
  let jobData;
  let completed = 1;
  try {
    conn = await pool.getConnection();
    resp = await conn.query(`
            SELECT j.jid, j.query, j.siteurl, j.general, j.news, c.cname, c.cid
            FROM searchbiasreport.jobs as j
            LEFT JOIN searchbiasreport.campaigns as c on j.cid = c.cid
            WHERE completed = 0 
            ORDER BY jid ASC
            LIMIT 1;
        `);
    console.log(resp.length);
    console.log(resp);
    jobData = resp.length ? resp[0] : null;
  } catch (err) {
    console.error(err);
  } finally {
    if (conn) {
      console.log("ending db conn...");
      await conn.end();
    }
  }

  console.log({ jobData });

  if (!jobData) {
    console.log("No trabajo");
    process.exit();
  }

  // const s3Key = `sbr/${normalizeString(jobData.cname)}/${normalizeString(jobData.query)}/`
  //    const term = {
  //      query: 'is isreal a good country?',
  //    site: ''
  //}
  const term = {
    query: jobData.query,
    site: jobData.siteurl,
  };

  const browser = await puppeteer.launch({
    headless: true,
    // headless: false,
    slowMo: 100,
    args: [
      "--no-sandbox",
      "--disable-gpu",
      "--single-process",
      "--no-zygote",
    ],
  });
  const page = await browser.newPage();
  await page.setUserAgent(generalUA);
  // await page.setViewport({
  //   height: 1200,
  //   width: 800,
  // });

  console.log("Browser initiated.");
  // await page.setUserAgent(
  //     "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.0.0 Mobile Safari/537.36"
  // );

  let csvString = `Search Bias Report - ${new Date().toDateString()}\n\n`;
  // for (let i = 0; i < searchTerms.length; ++i) {
  const allData = {
    maxLength: 0,
  };

  let searchtab = "general";
  let searchEngines = searchEnginesGeneral;
  if (!!jobData.news) {
    searchtab = "news";
    searchEngines = searchEnginesNews;
  }

  // for (const [engineKey, engineValue] of Object.entries(searchEnginesNews)) {

  for (const [engineKey, engineValue] of Object.entries(searchEngines)) {
    try {
      const url = engineValue.replace(
        "[[SEARCH_QUERY]]",
        normalizeString(term.query)
      );
      console.log({ term, engine: engineKey, searchtab });
      await page.goto(url, {
        waitUntil: "domcontentloaded",
      });

      //generate screenshot file path to pass down to the screen shot function
      //had to rejigger this because i needed to take pictures of multiple pages
      const screenshotFilePath = `${__dirname}/exports/${normalizeString(
        jobData.cname
      )}/${normalizeString(term.query)}_${searchtab}_sbr/`;
      // const screenshotFilePath = `${__dirname}/${outputDirectory}/${normalizeString(term.query)}_sbr/`
      const fileName = `${normalizeString(term.query)}_${engineKey}`;

      let data = [];

      if (!!jobData.general) {
        searchtab = "general";
        data = await extractLinks(
          engineKey,
          page,
          screenshotFilePath,
          fileName
        );
      } else if (!!jobData.news) {
        searchtab = "news";
        data = await extractNewsLinks(
          engineKey,
          page,
          screenshotFilePath,
          fileName
        );
      } else {
        console.log("fail");
        console.log("no search tab selected");
        completed = 0;
      }

      console.log({ data, length: data.length });

      // csvString += `Query:,${term}\n`
      // csvString += `Search Engine:,${keyToLabel(engineKey)}\n\n`

      if (!data.length) {
        console.log("fail");
        completed = 0;
        console.log(await page.content());
      }
      allData[engineKey] = data;
      allData.maxLength =
        allData.maxLength < data.length ? data.length : allData.maxLength;

      // break;
    } catch (err) {
      console.error(err);
      console.log(await page.content());
    }
  }

  // }

  await browser.close();

  const campaignWebsiteSite = {
    google: null,
    bing: null,
    duck: null,
    tusk: null,
  };

  csvString += `Search Query: ${term.query}\n`;
  csvString += `Campaign Websitre: ${term.site}\n\n`;
  csvString += `Position,Google,Bing,Duck Duck Go,Tusk\n`;

  for (let i = 0; i < allData.maxLength; ++i) {
    const googleData = allData["google"][i]
      ? `"=HYPERLINK(""${allData["google"][i].link}"",""${stripQuotes(
          allData["google"][i].text
        )}"")"`
      : " ";
    const bingData = allData["bing"][i]
      ? `"=HYPERLINK(""${allData["bing"][i].link}"",""${stripQuotes(
          allData["bing"][i].text
        )}"")"`
      : " ";
    const duckData = allData["duck"][i]
      ? `"=HYPERLINK(""${allData["duck"][i].link}"",""${stripQuotes(
          allData["duck"][i].text
        )}"")"`
      : " ";
    const tuskData = allData["tusk"][i]
      ? `"=HYPERLINK(""${allData["tusk"][i].link}"",""${stripQuotes(
          allData["tusk"][i].text
        )}"")"`
      : " ";

    if (
      allData["google"][i]?.link &&
      allData["google"][i].link.includes(term.site) &&
      campaignWebsiteSite["google"] == null
    ) {
      campaignWebsiteSite["google"] = i + 1;
    }
    if (
      allData["bing"][i]?.link &&
      allData["bing"][i].link.includes(term.site) &&
      campaignWebsiteSite["bing"] == null
    ) {
      campaignWebsiteSite["bing"] = i + 1;
    }
    if (
      allData["duck"][i]?.link &&
      allData["duck"][i].link.includes(term.site) &&
      campaignWebsiteSite["duck"] == null
    ) {
      campaignWebsiteSite["duck"] = i + 1;
    }
    if (
      allData["tusk"][i]?.link &&
      allData["tusk"][i].link.includes(term.site) &&
      campaignWebsiteSite["tusk"] == null
    ) {
      campaignWebsiteSite["tusk"] = i + 1;
    }

    csvString += `${i + 1},${googleData},${bingData},${duckData},${tuskData}\n`;
  }

  // for (let i = 0; i < allData.maxLength; ++i) {
  //     const googleData = allData['google'][i] ? `"=HYPERLINK(""${allData['google'][i].link}"",""${stripQuotes(allData['google'][i].text)}"")"` : " "
  //     const bingData = allData['bing'][i] ? `"=HYPERLINK(""${allData['bing'][i].link}"",""${stripQuotes(allData['bing'][i].text)}"")"` : " "
  //     const duckData = allData['duck'][i] ? `"=HYPERLINK(""${allData['duck'][i].link}"",""${stripQuotes(allData['duck'][i].text)}"")"` : " "
  //     const tuskData = allData['tusk'][i] ? `"=HYPERLINK(""${allData['tusk'][i].link}"",""${stripQuotes(allData['tusk'][i].text)}"")"` : " "

  //     if (allData['google'][i]?.link.includes(term.site) && campaignWebsiteSite['google'] == null) {
  //         campaignWebsiteSite['google'] = i + 1
  //     }
  //     if (allData['bing'][i]?.link.includes(term.site) && campaignWebsiteSite['bing'] == null) {
  //         campaignWebsiteSite['bing'] = i + 1
  //     }
  //     if (allData['duck'][i]?.link.includes(term.site) && campaignWebsiteSite['duck'] == null) {
  //         campaignWebsiteSite['duck'] = i + 1
  //     }
  //     if (allData['tusk'][i]?.link.includes(term.site) && campaignWebsiteSite['tusk'] == null) {
  //         campaignWebsiteSite['tusk'] = i + 1
  //     }

  //     csvString += `${i + 1},${googleData},${bingData},${duckData},${tuskData}\n`
  // }

  csvString += `Campaign Website: ${term.site},Website Position: ${campaignWebsiteSite["google"]},Website Position: ${campaignWebsiteSite["bing"]},Website Position: ${campaignWebsiteSite["duck"]},Website Position: ${campaignWebsiteSite["tusk"]}\n`;

  try {
    const exportFileName = `./exports/${normalizeString(
      jobData.cname
    )}/${normalizeString(term.query)}_${searchtab}_sbr/${normalizeString(
      term.query
    )}_sbr.csv`;
    // const exportFileName = `./${outputDirectory}/${normalizeString(term.query)}_sbr/${normalizeString(term.query)}_sbr.csv`
    fs.writeFileSync(exportFileName, csvString);
    fs.writeFileSync("searchBiasReport.csv", csvString);
    console.log(`Data Written to ${exportFileName}`);
  } catch (err) {
    console.error("error saving csv");
    completed = 0;
  }

  try {
    conn = await pool.getConnection();
    resp = await conn.query(`UPDATE jobs SET completed = ? WHERE jid = ?;`, [
      completed,
      jobData.jid,
    ]);
    console.log(resp);

    let total_resp = await conn.query(
      "SELECT COUNT(cid) as count FROM jobs WHERE cid = ?",
      [jobData.cid]
    );
    let completed_resp = await conn.query(
      "SELECT COUNT(cid) as count FROM jobs WHERE cid = ? and completed = 1",
      [jobData.cid]
    );

    const total = Number(total_resp[0]["count"]);
    const completed_items = Number(completed_resp[0]["count"]);
    console.log({ total, completed_items });

    if (total == completed_items) {
      const finalZipPath = `${__dirname}/exports/${normalizeString(
        jobData.cname
      )}.zip`;
      await zipDirectory(
        `${__dirname}/exports/${normalizeString(jobData.cname)}`,
        finalZipPath
      );
      //attempt upload
      console.log("alrighty, lets upload this bad boy CSV");
      // s3.upload(
      //     {
      //         Bucket: 'mrc7',
      //         Key: `${s3Key}${normalizeString(term.query)}_sbr.csv`,
      //         Body: csvString,
      //         ContentEncoding: 'utf-8'
      //     },
      //     (err, data) => {
      //         if (err) {
      //             throw err
      //         }
      //         console.log(`file uploaded succesfully`, data)
      //         console.log('fileLink:', data.Location)
      //     }
      // )
      const blob = fs.readFileSync(finalZipPath);

      const s3Data = await s3
        .upload({
          Bucket: "mrc7",
          Key: `sbr/${normalizeString(jobData.cname)}.zip`,
          Body: blob,
        })
        .promise();

      console.log({ s3Data });

      const fileDownloadLink = s3Data?.Location || null;

      if (fileDownloadLink) {
        fs.rmdirSync(`${__dirname}/exports/${normalizeString(jobData.cname)}`, {
          recursive: true,
        });
        fs.unlinkSync(finalZipPath);
        resp = await conn.query(
          `UPDATE campaigns SET link = ? WHERE cid = ?;`,
          [fileDownloadLink, jobData.cid]
        );
        console.log(resp);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    if (conn) {
      console.log("ending db conn...");
      await conn.end();
    }
    process.exit();
  }
})();
