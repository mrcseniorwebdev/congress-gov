const fs = require("fs");
const pool = require("./db");

const archiver = require("archiver");

const min_threshold = 100;

/**
 * Asynchronously retrieves a job that is not completed from the database.
 *
 * @async
 * @function getJobs
 * @returns {Object|null} Returns a job object if found, otherwise null.
 */
const getJobs = async () => {
  let conn; // Database connection
  let resp; // Query response
  let jobData; // Job data to be returned

  try {
    // Get a connection from the connection pool
    conn = await pool.getConnection();

    // Execute the SQL query to retrieve a job that is not completed
    resp = await conn.query(`
        SELECT j.jid, j.query, j.siteurl, j.general, j.news, c.cname, c.cid
        FROM searchbiasreport.jobs as j
        LEFT JOIN searchbiasreport.campaigns as c on j.cid = c.cid
        WHERE completed = 0 
        ORDER BY jid ASC
        LIMIT 1;
      `);

    // Log the number of rows returned by the query
    console.log(resp.length);

    // Log the response from the query
    console.log(resp);

    // If a job is found, set jobData to the first result; otherwise, set it to null
    jobData = resp.length ? resp[0] : null;
  } catch (err) {
    // Log any errors that occur during the database operation
    console.error(err);
  } finally {
    // Ensure the database connection is closed
    if (conn) {
      console.log("ending db conn...");
      await conn.end();
    }
  }

  return jobData;
};
// const getJobs = async () => {
//   let conn;
//   let resp;
//   let jobData;
//   try {
//     conn = await pool.getConnection();
//     resp = await conn.query(`
//               SELECT j.jid, j.query, j.siteurl, j.general, j.news, c.cname, c.cid
//               FROM searchbiasreport.jobs as j
//               LEFT JOIN searchbiasreport.campaigns as c on j.cid = c.cid
//               WHERE completed = 0
//               ORDER BY jid ASC
//               LIMIT 1;
//           `);
//     console.log(resp.length);
//     console.log(resp);
//     jobData = resp.length ? resp[0] : null;
//   } catch (err) {
//     console.error(err);
//   } finally {
//     if (conn) {
//       console.log("ending db conn...");
//       await conn.end();
//     }
//   }
// };

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

/**
 * Normalize a search term by converting it to lowercase and replacing non-alphanumeric characters with a plus (+) sign.
 *
 * This function is typically used for preparing search queries to be appended to URLs.
 *
 * @param {string} term - The search term to be normalized.
 * @returns {string} The normalized search term, with spaces and other non-alphanumeric characters replaced by "+".
 */
const normalizeString = (term) => {
  // Convert the search term to lowercase
  let ret = term.toLowerCase();

  // Replace non-alphanumeric characters (anything other than a-z, A-Z, and digits) with a plus (+) sign
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

/**
 * Scroll the page automatically to the bottom to lazy-load all content.
 *
 * This function is typically used with Puppeteer to ensure all dynamically loaded content
 * (e.g., infinite scroll pages) is loaded by simulating a user scroll action.
 *
 * @param {Object} page - The Puppeteer page object to be scrolled.
 * @returns {Promise<void>} A promise that resolves when the scrolling action is complete.
 */
const autoScroll = async (page) => {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      // Initialize the total height scrolled and the distance to scroll each step
      let totalHeight = 0;
      const distance = 100;

      const timer = setInterval(() => {
        // Scroll by a fixed distance in each interval
        window.scrollBy(0, distance);
        totalHeight += distance;

        // Get the current scroll height of the page
        const scrollHeight = document.body.scrollHeight;

        // Log scroll details for debugging
        // console.log("scrolling...", {
        //   totalHeight,
        //   scrollHeight,
        //   "window.innerHeight": window.innerHeight,
        // });

        // If the total height scrolled is greater than or equal to the scroll height minus the window height, stop scrolling
        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 20); // Set the interval time to scroll every 20 milliseconds
    });
  });
};

/**
 * Scroll a specific div element automatically to the bottom to lazy-load all content within it.
 *
 * This function is typically used with Puppeteer to ensure all dynamically loaded content within a specific div
 * (e.g., infinite scroll sections) is loaded by simulating a user scroll action.
 *
 * @param {Object} page - The Puppeteer page object to interact with.
 * @param {string} selector - The CSS selector of the div element to be scrolled.
 * @returns {Promise<void>} A promise that resolves when the scrolling action is complete or times out.
 */
const autoScrollDiv = async (page, selector) => {
  await page.evaluate(async (selector) => {
    await new Promise((resolve) => {
      // Initialize the total height scrolled and the distance to scroll each step
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

      // Function to perform the scroll action
      const scrollFunction = () => {
        const scrollHeight = scrollableElement.scrollHeight;
        const clientHeight = scrollableElement.clientHeight;

        // Scroll by a fixed distance in each interval
        scrollableElement.scrollBy(0, distance);
        totalHeight += distance;

        // Log scroll details for debugging
        console.log({
          totalHeight,
          scrollHeight,
          clientHeight,
          "scrollableElement.scrollTop": scrollableElement.scrollTop,
        });

        // If the total height scrolled plus the client height is greater than or equal to the scroll height, stop scrolling
        if (totalHeight + clientHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      };

      // Set the interval to perform the scroll action
      const timer = setInterval(scrollFunction, scrollInterval);

      // Safety timeout to ensure the function completes after a maximum duration (30 seconds)
      setTimeout(() => {
        clearInterval(timer);
        resolve();
      }, 30000); // 30,000 ms = 30 seconds
    });
  }, selector);
};

/**
 * Clicks the "More search results" button on Google search page after auto-scrolling.
 *
 * @param {Object} page - Puppeteer page object.
 * @returns {Promise<void>}
 */
const googleMoreResultsBtn = async (page) => {
  console.log("one more autoscroll");
  await autoScroll(page);
  console.log("wait for selector");

  await page.waitForSelector('a[aria-label="More search results"]', {
    visible: true,
  });

  console.log("click");
  await page.click('a[aria-label="More search results"]');
};

/**
 * Clicks the next page button in the pagination ul after the currently selected li element.
 *
 * @param {Object} page - Puppeteer page object.
 * @returns {Promise<void>}
 */
const tuskMoreResultsBtn = async (page) => {
  console.log("Waiting for the pagination elements");

  // Ensure the pagination exists and is visible
  await page.waitForSelector("tusk-navigation-pager", {
    visible: true,
  });

  try {
    // Find the currently selected page number
    const selectedElement = await page.$(
      "tusk-navigation-pager li span.selected"
    );

    if (selectedElement) {
      // Get the parent li of the selected span
      const parentLi = await selectedElement.evaluateHandle(
        (node) => node.parentElement
      );

      // Get the next sibling li of the currently selected li
      const nextLi = await parentLi.evaluateHandle(
        (node) => node.nextElementSibling
      );

      if (nextLi) {
        // Click on the span inside the next li element
        const nextSpan = await nextLi.$("span");
        if (nextSpan) {
          console.log("Clicking the next page number");
          await nextSpan.click();
        } else {
          console.log("Next span not found");
        }
      } else {
        console.log("No next sibling found");
      }
    } else {
      console.log("Selected element not found");
    }
  } catch (error) {
    console.error("Error clicking the next page:", error);
  }
};

// /**
//  * Clicks the "More results" button on Tusk search page after auto-scrolling and handling possible exceptions.
//  *
//  * @param {Object} page - Puppeteer page object.
//  * @returns {Promise<void>}
//  */
// const tuskMoreResultsBtn = async (page) => {
//   console.log("one more autoscroll");
//   // await page.waitForSelector(".search-results-infinite-scroll");
//   // await autoScrollDiv(page, ".search-results-infinite-scroll");
//   await autoScroll(page);

//   try {
//     console.log("wait for selector");
//     await page.waitForSelector("button.btn-more-results", {
//       visible: true,
//     });
//   } catch (e) {
//     console.log("scroll again");
//     await autoScrollDiv(page, ".search-results-infinite-scroll");
//     console.log("wait for selector part deux");
//     await page.waitForSelector("button.btn-more-results", {
//       visible: true,
//     });
//   }

//   console.log("click");
//   await page.click("button.btn-more-results");
// };

/**
 * Clicks the "Next page" link on Bing search page after auto-scrolling.
 *
 * @param {Object} page - Puppeteer page object.
 * @returns {Promise<void>}
 */
const bingMoreResultsBtn = async (page) => {
  console.log("one more autoscroll");
  await autoScroll(page);
  console.log("wait for selector");

  await page.waitForSelector('a[title="Next page"]', {
    visible: true,
  });

  console.log("click");
  await page.click('a[title="Next page"]');
};

/**
 * Clicks the "More results" button on DuckDuckGo search page after auto-scrolling.
 *
 * @param {Object} page - Puppeteer page object.
 * @returns {Promise<void>}
 */
const duckMoreResultsBtn = async (page) => {
  console.log("one more autoscroll");
  await autoScroll(page);
  console.log("wait for selector");

  await page.waitForSelector("#more-results", {
    visible: true,
  });

  console.log("click");
  await page.click("#more-results");
};

/**
 * Extract links from search results pages from various search engines.
 *
 * @param {string} engine - Search engine name ('google', 'bing', 'brave', 'tusk', 'duck').
 * @param {Object} page - Puppeteer page object.
 * @param {string} screenshotFilePath - File path to save the screenshots.
 * @param {string} fileName - File name for the screenshots.
 * @returns {Promise<Array<{link: string, text: string}>>} - Extracted links and texts.
 */
const extractLinks = async (engine, page, screenshotFilePath, fileName) => {
  let allCards = [];

  if (engine === "google") {
    await autoScroll(page);
    await autoScroll(page);
    await autoScroll(page);
    await autoScroll(page);

    await page.waitForSelector('div[data-snc]', {
      visible: true,
      timeout: 120000,  // 2 minutes in milliseconds
    });
  

    // const extraPages = 5;

    // for (let i = 0; i < extraPages; ++i) {
    // }

    allCards = await page.$$eval("div[data-snc]", (cards) => {
      return cards
        .map((card) => {
          const heading = card.querySelector('div[role="heading"]');
          const link = card.querySelector("a")?.href;
          if (heading && link) {
            const text = heading.textContent;
            return { link, text };
          }
          return null;
        })
        .filter((elem) => elem != null);
    });

    // let unchangedIterations = 0;

    // while (allCards.length < min_threshold && unchangedIterations < 3) {
    //   const previousLength = allCards.length;

    //   console.log(`${allCards.length} / ${min_threshold} items`);
    //   await googleMoreResultsBtn(page);
    //   await page.waitForTimeout(2000); // Small wait after clicking more results

    //   allCards = await page.$$eval("div[data-snc]", (cards) => {
    //     return cards
    //       .map((card) => {
    //         const heading = card.querySelector('div[role="heading"]');
    //         const link = card.querySelector("a")?.href;
    //         if (heading && link) {
    //           const text = heading.textContent;
    //           return { link, text };
    //         }
    //         return null;
    //       })
    //       .filter((elem) => elem != null);
    //   });

    //   if (allCards.length === previousLength) {
    //     unchangedIterations++;
    //   } else {
    //     unchangedIterations = 0;
    //   }
    // }
    console.log("screenshot...");
    await pageScreenshot(page, screenshotFilePath, fileName, null);

    return allCards;
  }

  if (engine === "bing") {
    await page.waitForSelector(".b_algoheader");
    // const allCards = [];
    // const pages = 5;
    let pageNumber = 1;
    let unchangedIterations = 0;

    await autoScroll(page);
    await autoScroll(page);
    await autoScroll(page);

    const Cards = await page.$$eval(".b_algoheader", (cards) => {
      return cards
        .map((card) => {
          const link = card.querySelector("a").href;
          const text = card.querySelector("h2").innerText;
          return { link, text };
        })
        .filter((elem) => elem != null);
    });

    allCards.push(...Cards);
    console.log("screenshot...");
    await pageScreenshot(page, screenshotFilePath, fileName, pageNumber);

    // while (allCards.length < min_threshold && unchangedIterations < 3) {
    //   const previousLength = allCards.length;

    //   console.log(`${allCards.length} / ${min_threshold} items`);
    //   await autoScroll(page);
    //   await autoScroll(page);
    //   await autoScroll(page);

    //   const Cards = await page.$$eval(".b_algoheader", (cards) => {
    //     return cards
    //       .map((card) => {
    //         const link = card.querySelector("a").href;
    //         const text = card.querySelector("h2").innerText;
    //         return { link, text };
    //       })
    //       .filter((elem) => elem != null);
    //   });

    //   allCards.push(...Cards);
    //   console.log("screenshot...");
    //   await pageScreenshot(page, screenshotFilePath, fileName, pageNumber);

    //   if (allCards.length === previousLength) {
    //     unchangedIterations++;
    //   } else {
    //     unchangedIterations = 0;
    //   }

    //   await bingMoreResultsBtn(page);
    //   ++pageNumber;
    // }

    return allCards;
  }

  //brave is not used, keeping here for a jump off point incase they want support again in the future
  if (engine === "brave") {
    await autoScroll(page);
    await autoScroll(page);

    let unchangedIterations = 0;

    const braveCards = await page.$$eval(
      ".result-header .snippet-title",
      (cards) => {
        return cards
          .map((card) => {
            const text = card.innerText;
            let currNode = card.parentNode;
            while (currNode.tagName !== "A") {
              currNode = currNode.parentNode;
            }
            const link = currNode.href;
            return { link, text };
          })
          .filter((elem) => elem != null);
      }
    );

    console.log("screenshot...");
    await pageScreenshot(page, screenshotFilePath, fileName, null);

    return braveCards;
  }

  if (engine === "tusk") {
    await page.waitForSelector(".result-card");
    let unchangedIterations = 0;
    let pageNumber = 1;

    await autoScroll(page);
    await autoScroll(page);
    // await autoScroll(page);
    // await tuskMoreResultsBtn(page);
    // await page.waitForTimeout(2000); // Small wait after clicking more results

    const Cards = await page.$$eval(".result-card a.title", (cards) => {
      return cards
        .map((card) => {
          const text = card.innerText;
          const link = card.href;
          return { link, text };
        })
        .filter((elem) => elem != null);
    });

    allCards.push(...Cards);
    console.log("screenshot...");
    await pageScreenshot(page, screenshotFilePath, fileName, pageNumber);

    // while (allCards.length < min_threshold && unchangedIterations < 3) {
    //   const previousLength = allCards.length;

    //   console.log(`${allCards.length} / ${min_threshold} items`);

    //   await autoScroll(page);
    //   await autoScroll(page);
    //   // await autoScroll(page);
    //   // await tuskMoreResultsBtn(page);
    //   // await page.waitForTimeout(2000); // Small wait after clicking more results

    //   const Cards = await page.$$eval(".result-card a.title", (cards) => {
    //     return cards
    //       .map((card) => {
    //         const text = card.innerText;
    //         const link = card.href;
    //         return { link, text };
    //       })
    //       .filter((elem) => elem != null);
    //   });

    //   allCards.push(...Cards);
    //   console.log("screenshot...");
    //   await pageScreenshot(page, screenshotFilePath, fileName, pageNumber);

    //   if (allCards.length === previousLength) {
    //     unchangedIterations++;
    //   } else {
    //     unchangedIterations = 0;
    //   }

    //   await page.waitForTimeout(2000); // Small wait after clicking more results
    //   await tuskMoreResultsBtn(page);
    //   ++pageNumber;
    // }

    return allCards;
  }

  if (engine === "duck") {
    await autoScroll(page);
    await autoScroll(page);
    let unchangedIterations = 0;
    allCards = await page.$$eval(".react-results--main h2 a", (cards) => {
      return cards
        .map((card) => {
          const link = card.href;
          const text = card.innerText;
          return { link, text };
        })
        .filter((elem) => elem != null);
    });
    // while (allCards.length < min_threshold && unchangedIterations < 3) {
    //   const previousLength = allCards.length;

    //   console.log(`${allCards.length} / ${min_threshold} items`);
    //   await duckMoreResultsBtn(page);
    //   await page.waitForTimeout(2000); // Small wait after clicking more results

    //   allCards = await page.$$eval(".react-results--main h2 a", (cards) => {
    //     return cards
    //       .map((card) => {
    //         const link = card.href;
    //         const text = card.innerText;
    //         return { link, text };
    //       })
    //       .filter((elem) => elem != null);
    //   });

    //   if (allCards.length === previousLength) {
    //     unchangedIterations++;
    //   } else {
    //     unchangedIterations = 0;
    //   }
    // }

    console.log("screenshot...");
    await pageScreenshot(page, screenshotFilePath, fileName, null);

    return allCards;
  }

  return [];
};

/**
 * Extract news links from search result pages from various search engines.
 *
 * @param {string} engine - Search engine name ('google', 'bing', 'brave', 'tusk', 'duck').
 * @param {Object} page - Puppeteer page object.
 * @param {string} screenshotFilePath - File path to save the screenshots.
 * @param {string} fileName - File name for the screenshots.
 * @returns {Promise<Array<{link: string, text: string}>>} - Extracted news links and texts.
 */
const extractNewsLinks = async (engine, page, screenshotFilePath, fileName) => {
  if (engine === "google") {
    await autoScroll(page);
    await autoScroll(page);

    const gCards = await page.$$eval("a[jsname]", (cards) => {
      return cards
        .map((card) => {
          const heading = card.querySelector('div[role="heading"]');
          const link = card?.href;
          if (heading && link) {
            const text = heading.textContent;
            return { link, text };
          }
          return null;
        })
        .filter((elem) => elem != null);
    });

    console.log("screenshot...");
    await pageScreenshot(page, screenshotFilePath, fileName, null);

    return gCards;
  }

  if (engine === "bing") {
    await page.waitForSelector(".newscard");
    await autoScroll(page);
    await autoScroll(page);
    await autoScroll(page);

    const Cards = await page.$$eval(".newscard", (cards) => {
      return cards
        .map((card) => {
          const link = card.getAttribute("data-url");
          const text = card.getAttribute("data-title");
          return { link, text };
        })
        .filter((elem) => elem != null);
    });

    console.log("screenshot...");
    await pageScreenshot(page, screenshotFilePath, fileName, null);

    return Cards;
  }

  if (engine === "brave") {
    await autoScroll(page);
    await autoScroll(page);

    const braveCards = await page.$$eval(
      ".result-header .snippet-title",
      (cards) => {
        return cards
          .map((card) => {
            const text = card.innerText;
            let currNode = card.parentNode;
            while (currNode.tagName !== "A") {
              currNode = currNode.parentNode;
            }
            const link = currNode.href;
            return { link, text };
          })
          .filter((elem) => elem != null);
      }
    );

    console.log("screenshot...");
    await pageScreenshot(page, screenshotFilePath, fileName, null);

    return braveCards;
  }

  if (engine === "tusk") {
    await page.waitForSelector(".result-card");
    await autoScroll(page);
    await autoScroll(page);

    const tuskCards = await page.$$eval(".result-card a.title", (cards) => {
      return cards
        .map((card) => {
          const text = card.innerText;
          const link = card.href;
          return { link, text };
        })
        .filter((elem) => elem != null);
    });

    console.log("screenshot...");
    await pageScreenshot(page, screenshotFilePath, fileName, null);

    return tuskCards;
  }

  if (engine === "duck") {
    await autoScroll(page);
    await autoScroll(page);

    const duckCards = await page.$$eval(
      ".result--news h2 .result__a",
      (cards) => {
        return cards
          .map((card) => {
            const link = card.href;
            const text = card.innerText;
            return { link, text };
          })
          .filter((elem) => elem != null);
      }
    );

    console.log("screenshot...");
    await pageScreenshot(page, screenshotFilePath, fileName, null);

    return duckCards;
  }

  return [];
};

/**
 * Captures a screenshot of the current state of the Puppeteer page, either of the entire page or a specific selector.
 *
 * @param {Object} page - Puppeteer page object.
 * @param {string} screenshotFilePath - The file path where the screenshot will be saved.
 * @param {string} fileName - The base file name for the screenshot.
 * @param {number|null} [pagenum=null] - The page number to include in the file name (optional).
 * @param {string|null} [selector=null] - The CSS selector of the element to screenshot (optional).
 * @returns {Promise<void>}
 */
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
      const element = await page.$(selector);
      if (element) {
        await element.screenshot({ path });
      }
    } else {
      await page.screenshot({
        path,
        fullPage: true,
        captureBeyondViewport: true,
      });
    }
    console.log("Success. Screenshot saved.");
  } catch (err) {
    console.error("Screenshot error: ", err);
    console.log("Attempting to create the broken path...");
    fs.mkdirSync(screenshotFilePath, { recursive: true });
    if (typeof selector === "string" && selector.length) {
      const element = await page.$(selector);
      if (element) {
        await element.screenshot({ path, captureBeyondViewport: true });
      }
    } else {
      await page.screenshot({
        path,
        fullPage: true,
        captureBeyondViewport: true,
      });
    }
    console.log("Success. Screenshot saved.");
  }
};

/**
 * Formats a CSV cell with a hyperlink.
 * @param {Object} data - The data object containing link and text properties.
 * @returns {string} The formatted CSV cell.
 */
function formatCsvCell(data) {
  return data
    ? `"=HYPERLINK(""${data.link}"",""${stripQuotes(data.text)}"")"`
    : " ";
}

/**
 * Updates the campaignWebsiteSite object with the position of the campaign website in search results.
 * @param {Object} allData - All search engine data.
 * @param {string} engine - The search engine name.
 * @param {number} index - The current position index.
 * @param {string} site - The campaign website URL.
 * @param {Object} campaignWebsiteSite - The campaign website positions.
 */
function updateCampaignWebsiteSite(
  allData,
  engine,
  index,
  site,
  campaignWebsiteSite
) {
  if (
    allData[engine][index]?.link &&
    allData[engine][index].link.includes(site) &&
    campaignWebsiteSite[engine] == null
  ) {
    campaignWebsiteSite[engine] = index + 1;
  }
}

module.exports = {
  getJobs,
  normalizeString,
  extractLinks,
  extractNewsLinks,
  zipDirectory,
  updateCampaignWebsiteSite,
  formatCsvCell,
};
