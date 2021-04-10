const { builderFunction } = require("@netlify/functions");
const chromium = require("chrome-aws-lambda");

function isFullUrl(url) {
  try {
    new URL(url);
    return true;
  } catch(e) {
    // invalid url OR local path
    return false;
  }
}

async function screenshot(url, viewportSize, withJs = true) {
  const browser = await chromium.puppeteer.launch({
    executablePath: await chromium.executablePath,
    args: chromium.args,
    defaultViewport: viewportSize,
    headless: chromium.headless,
  });

  const page = await browser.newPage();

  if(!withJs) {
    page.setJavaScriptEnabled(false);
  }

  await page.goto(url, {
    waitUntil: ["load", "networkidle0"]
  });

  let buffer = await page.screenshot({
    type: "jpeg",
    quality: 100,
  });

  await browser.close();

  return buffer;
}

// Based on https://github.com/DavidWells/netlify-functions-workshop/blob/master/lessons-code-complete/use-cases/13-returning-dynamic-images/functions/return-image.js
async function handler(event, context) {
  // /api/screenshot/:url/:dimensions/
  let pathSplit = event.path.split("/").filter(entry => !!entry);
  let [,, url, dimensions] = pathSplit;
  let [w, h] = dimensions.split("x");

  url = decodeURIComponent(url);

  try {
    if(!isFullUrl(url)) {
      throw new Error(`Invalid \`url\`: ${url}`);
    }

    let dims = {};
    // defaults to Macbook 13″
    dims.width = parseInt(w, 10) || 420;
    dims.height = parseInt(h, 10) || 580;

    let buffer = await screenshot(url, dims);

    return {
      statusCode: 200,
      headers: {
        "content-type": "image/jpeg"
      },
      body: buffer.toString("base64"),
      isBase64Encoded: true
    }
  } catch (error) {
    console.log("Error", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      })
    }
  }
}

exports.handler = builderFunction(handler);