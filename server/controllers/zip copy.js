const zipRouter = require("express").Router();
// const pool = require("../utils/db");
// const { authCheck } = require("../utils/authMiddleware");

/*
 * Get method
 */
zipRouter.get("/", async (req, res) => {
  try {
    const zip = req.query.zip;

    // Check if the zip parameter is provided
    if (!zip) {
      return res.status(400).json({ error: "ZIP code is required." });
    }

    // Optionally, you might want to validate the ZIP code format
    // For example, assuming a US ZIP code, it should be 5 digits
    const zipRegex = /^\d{5}$/;
    if (!zipRegex.test(zip)) {
      return res
        .status(400)
        .json({
          error: "Invalid ZIP code format. It should be a 5-digit number.",
        });
    }

    // Proceed with your logic if the ZIP code is valid
    // ...

    res.status(200).send(`Received ZIP code: ${zip}`);
  } catch (error) {
    // Log and return a generic error message for unexpected issues
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = zipRouter;
