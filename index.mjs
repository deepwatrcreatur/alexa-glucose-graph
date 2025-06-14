import * as Alexa from "ask-sdk-core";
import axios from "axios";
import crypto from "crypto";

// APL document with highly customized layout and larger fonts
const APL_DOCUMENT = {
  type: "APL",
  version: "1.8",
  mainTemplate: {
    parameters: ["data"],
    items: [
      {
        type: "Container",
        width: "100vw",
        height: "100vh",
        direction: "column",
        alignItems: "center",
        justifyContent: "start",
        paddingTop: "15dp",
        backgroundColor: "#000000",
        items: [
          // Row 1: Nightscout Monitor (left) | Updated Time (right)
          {
            type: "Container",
            direction: "row",
            alignItems: "center",
            justifyContent: "spaceBetween", // Pushes items to opposite ends
            paddingBottom: "8dp", // Reduced padding
            width: "90vw", // Constrain width for alignment
            items: [
              {
                type: "Text",
                text: "🩸 Nightscout Monitor",
                fontSize: "26dp", // Slightly smaller for fit
                color: "#FFFFFF",
                textAlign: "left",
                grow: 1,
              },
              {
                type: "Text",
                text: "Updated: ${data.lastUpdated}", // Updated time
                fontSize: "26dp", // Same size as title
                color: "#FFFFFF", // White color as requested
                textAlign: "right",
                grow: 1,
              },
            ],
          },
          // Row 2: Current Reading (bold, large, centered) - NOW LINE 2
          {
            type: "Container",
            direction: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingBottom: "10dp", // Padding below this row
            items: [
              {
                type: "Text",
                text: "${data.lastReading}", // Current Reading
                fontSize: "52dp", // STILL EVEN BIGGER
                color: "#00FF00",
                fontWeight: "bold",
                textAlign: "center",
              },
            ],
          },
          // Row 3: Trend Icon + Time Range (left) | Target Range (center) | Stable/Rising/Falling (right)
          {
            type: "Container",
            direction: "row",
            alignItems: "center",
            justifyContent: "spaceBetween", // Space evenly across the line
            paddingBottom: "15dp", // Padding below this row
            width: "90vw", // Constrain width for alignment
            items: [
              {
                type: "Text",
                text: "${data.trendIndicatorIcon} Last ${data.timeRange}", // Icon + Time Range
                fontSize: "26dp",
                color: "#FFFFFF",
                textAlign: "left", // Left-justify
                width: "30%", // Give it a fixed width
                shrink: 1,
              },
              {
                type: "Text",
                text: "${data.targetRangeText}", // Target Range text
                fontSize: "24dp", // Slightly smaller to fit
                color: "#CCCCCC",
                textAlign: "center", // Center-justify
                width: "40%", // Give it a fixed width
                shrink: 1,
              },
              {
                type: "Text",
                text: "${data.trendText}", // Stable/Rising/Falling Text
                fontSize: "26dp",
                color: "#FFFF00", // Yellow as requested
                textAlign: "right", // Right-justify
                width: "30%", // Give it a fixed width
                shrink: 1,
              },
            ],
          },
          {
            type: "Container", // Main data container for readings
            width: "95vw",
            height: "580dp", // Adjusted height to accommodate new top rows and larger table
            backgroundColor: "#111111",
            borderWidth: "2dp",
            borderColor: "#333333",
            borderRadius: "10dp",
            paddingTop: "15dp",
            paddingBottom: "15dp",
            paddingLeft: "25dp", // Increased horizontal padding
            paddingRight: "25dp", // Increased horizontal padding
            items: [
              {
                type: "ScrollView",
                width: "100%",
                grow: 1,
                items: [
                  {
                    type: "Container",
                    direction: "column",
                    items: "${data.readingsList}",
                  },
                ],
              },
            ],
          },
          // Legend below the main container
          {
            type: "Container",
            direction: "column",
            alignItems: "center",
            justifyContent: "center",
            paddingTop: "15dp", // Adjusted padding
            paddingBottom: "15dp", // Adjusted padding
            items: [
              {
                type: "Text",
                text: "🔺 High   ✅ Normal   🔻 Low",
                fontSize: "15dp",
                color: "#FFFFFF",
                textAlign: "center",
              },
              {
                type: "Text",
                text: "↗ Rising   → Stable   ↘ Falling",
                fontSize: "15dp",
                color: "#FFFF00",
                textAlign: "center",
                paddingTop: "5dp",
              },
            ],
          },
        ],
      },
    ],
  },
};

// Generate individual text components for each reading
function generateReadingComponents(entries, isMmol, timezone) {
  if (entries.length < 2) {
    return [
      {
        type: "Text",
        text: "Not enough data available",
        fontSize: "28dp", // Larger error font
        color: "#FF0000",
        textAlign: "center",
      },
    ];
  }

  const displayEntries = entries.slice(-6); // Keep to 6 entries for max size
  const unit = isMmol ? "mmol/L" : "mg/dL";
  const targetRange = isMmol ? [4, 10] : [80, 180];

  let components = [];

  // Each reading as separate component
  displayEntries.reverse().forEach((entry, reverseIndex) => {
    const value = isMmol ? (entry.sgv / 18).toFixed(1) : entry.sgv;
    const numericValue = isMmol ? entry.sgv / 18 : entry.sgv;

    const date = new Date(entry.date);
    // Format time including AM/PM in a single string
    const formattedTimeWithAmPm = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone,
    }).format(date);

    // Status indicator and color
    let indicator = "";
    let valueColor = "#00FFFF";
    if (numericValue < targetRange[0]) {
      indicator = "🔻";
      valueColor = "#FF6B6B"; // Reddish for low
    } else if (numericValue > targetRange[1]) {
      indicator = "🔺";
      valueColor = "#FFB347"; // Orangish for high
    } else {
      indicator = "✅";
      valueColor = "#90EE90"; // Greenish for normal
    }

    // Trend arrow
    let trend = "";
    const originalIndex = entries.length - 1 - (displayEntries.length - 1 - reverseIndex);

    if (originalIndex > 0) { // Ensure there is a preceding entry in the full data set
      const prevEntry = entries[originalIndex - 1];
      const prevValue = isMmol ? prevEntry.sgv / 18 : prevEntry.sgv;
      const diff = numericValue - prevValue;
      const threshold = isMmol ? 0.2 : 4;

      if (diff > threshold) trend = " ↗";
      else if (diff < -threshold) trend = " ↘";
      else trend = " →";
    }

    components.push({
      type: "Container",
      direction: "row",
      alignItems: "center",
      justifyContent: "spaceBetween",
      paddingBottom: "18dp", // Space between rows
      items: [
        {
          type: "Text", // Now a single Text component for time and AM/PM
          text: formattedTimeWithAmPm,
          fontSize: "30dp", // Consistent font size
          color: "#CCCCCC",
          textAlign: "left", // Left-aligned
          width: "120dp", // Adjusted width to fit "H:MM PM" comfortably
        },
        {
          type: "Text",
          text: indicator,
          fontSize: "36dp", // Bigger indicators
          width: "50dp", // Adjusted width
          textAlign: "center",
        },
        {
          type: "Text",
          text: `${value} ${unit}`,
          fontSize: "30dp", // Consistent font size
          color: valueColor,
          textAlign: "right",
          width: "170dp", // Adjusted width
        },
        {
          type: "Text",
          text: trend,
          fontSize: "30dp", // Consistent font size
          color: "#FFFF00",
          width: "45dp", // Adjusted width
          textAlign: "center",
        },
      ],
    });
  });

  return components;
}

// Helper function to determine trend (now returns just icon and text)
function getTrendIndicator(entries, isMmol) {
  if (entries.length < 2) return { icon: "📊", text: "Single Reading" };

  const current = isMmol
    ? entries[entries.length - 1].sgv / 18
    : entries[entries.length - 1].sgv;
  const previous = isMmol
    ? entries[entries.length - 2].sgv / 18
    : entries[entries.length - 2].sgv;

  const diff = current - previous;
  const threshold = isMmol ? 0.3 : 5;

  if (diff > threshold) {
    return { icon: "📈", text: "Rising" };
  } else if (diff < -threshold) {
    return { icon: "📉", text: "Falling" };
  } else {
    return { icon: "➡️", text: "Stable" };
  }
}

// Helper function to format time with timezone
function formatTimeWithTimezone(date, timezone) {
  const timeOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  };

  const formattedTime = new Intl.DateTimeFormat("en-US", timeOptions)
    .format(date)
    .toUpperCase()
    .replace(/\./g, "");

  const tzOptions = {
    timeZoneName: "short",
    timeZone: timezone,
  };

  const tzAbbr =
    new Intl.DateTimeFormat("en-US", tzOptions)
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value || timezone;

  return `${formattedTime} ${tzAbbr}`;
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest"
    );
  },
  handle(handlerInput) {
    console.log("[LOG] LAUNCH REQUEST HANDLER");
    return DisplayGraphIntentHandler.handle(handlerInput);
  },
};

const DisplayGraphIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "DisplayGraphIntent"
    );
  },
  async handle(handlerInput) {
    console.log("[LOG] DISPLAY GRAPH INTENT HANDLER START");

    try {
      const supportedInterfaces = Alexa.getSupportedInterfaces(
        handlerInput.requestEnvelope
      );

      let nightscoutUrl = process.env.NIGHTSCOUT_URL;
      const apiSecret = process.env.NIGHTSCOUT_API_SECRET;
      const unitType = process.env.UNIT_TYPE || "mmol";
      const timezone = process.env.TIMEZONE || "UTC";

      // Determine target range text for display
      const isMmol = unitType.toLowerCase() === "mmol";
      const targetRange = isMmol ? [4, 10] : [80, 180];
      const unit = isMmol ? "mmol/L" : "mg/dL";
      const targetRangeText = `TARGET: ${targetRange[0]}-${targetRange[1]} ${unit}`;


      if (!nightscoutUrl || !apiSecret) {
        return handlerInput.responseBuilder
          .addDirective({
            type: "Alexa.Presentation.APL.RenderDocument",
            document: APL_DOCUMENT,
            datasources: {
              data: {
                lastReading: "Config Error",
                trendIndicatorIcon: "❌",
                trendText: "Setup Required",
                lastUpdated: "Missing env vars",
                timeRange: "",
                targetRangeText: targetRangeText, // Pass new property
                readingsList: [
                  {
                    type: "Text",
                    text: "CONFIGURATION REQUIRED:",
                    fontSize: "28dp",
                    color: "#FF0000",
                    textAlign: "center",
                    paddingBottom: "10dp",
                  },
                  {
                    type: "Text",
                    text: "• Set NIGHTSCOUT_URL",
                    fontSize: "24dp",
                    color: "#FFFF00",
                  },
                  {
                    type: "Text",
                    text: "• Set NIGHTSCOUT_API_SECRET",
                    fontSize: "24dp",
                    color: "#FFFF00",
                  },
                  {
                    type: "Text",
                    text: "• Set UNIT_TYPE (mmol or mg)",
                    fontSize: "24dp",
                    color: "#FFFF00",
                  },
                  {
                    type: "Text",
                    text: "• Set TIMEZONE",
                    fontSize: "24dp",
                    color: "#FFFF00",
                  },
                ],
              },
            },
          })
          .getResponse();
      }

      // Normalize URL
      nightscoutUrl = nightscoutUrl.replace(/^https?:\/(?!\/)/, "https://");
      if (!nightscoutUrl.startsWith("https://")) {
        nightscoutUrl = "https://" + nightscoutUrl;
      }

      const hashedSecret = crypto
        .createHash("sha1")
        .update(apiSecret)
        .digest("hex");
      const entryCount = 15; // Still fetching enough for trends

      let response;
      try {
        response = await axios.get(
          `${nightscoutUrl}/api/v1/entries.json?count=${entryCount}`,
          {
            headers: { "api-secret": hashedSecret },
            timeout: 10000,
          }
        );
      } catch (apiError) {
        return handlerInput.responseBuilder
          .addDirective({
            type: "Alexa.Presentation.APL.RenderDocument",
            document: APL_DOCUMENT,
            datasources: {
              data: {
                lastReading: "API Error",
                trendIndicatorIcon: "❌",
                trendText: "Connection Failed",
                lastUpdated: "Unable to fetch data",
                timeRange: "",
                targetRangeText: targetRangeText, // Pass new property
                readingsList: [
                  {
                    type: "Text",
                    text: "CONNECTION ERROR:",
                    fontSize: "28dp",
                    color: "#FF0000",
                    textAlign: "center",
                    paddingBottom: "10dp",
                  },
                  {
                    type: "Text",
                    text: apiError.message,
                    fontSize: "24dp",
                    color: "#FFFF00",
                    textAlign: "center",
                  },
                  {
                    type: "Text",
                    text: "Check:",
                    fontSize: "26dp",
                    color: "#FFFFFF",
                    paddingTop: "10dp",
                  },
                  {
                    type: "Text",
                    text: "• Nightscout URL is correct",
                    fontSize: "24dp",
                    color: "#FFFF00",
                  },
                  {
                    type: "Text",
                    text: "• API secret is valid",
                    fontSize: "24dp",
                    color: "#FFFF00",
                  },
                  {
                    type: "Text",
                    text: "• Internet connection",
                    fontSize: "24dp",
                    color: "#FFFF00",
                  },
                ],
              },
            },
          })
          .getResponse();
      }

      if (response.data.length === 0) {
        return handlerInput.responseBuilder
          .addDirective({
            type: "Alexa.Presentation.APL.RenderDocument",
            document: APL_DOCUMENT,
            datasources: {
              data: {
                lastReading: "No Data",
                trendIndicatorIcon: "❌",
                trendText: "No Readings",
                lastUpdated: "No recent entries found",
                timeRange: "",
                targetRangeText: targetRangeText, // Pass new property
                readingsList: [
                  {
                    type: "Text",
                    text: "NO DATA AVAILABLE",
                    fontSize: "28dp",
                    color: "#FF0000",
                    textAlign: "center",
                    paddingBottom: "10dp",
                  },
                  {
                    type: "Text",
                    text: "No recent glucose readings found",
                    fontSize: "26dp",
                    color: "#FFFF00",
                    textAlign: "center",
                  },
                  {
                    type: "Text",
                    text: "in your Nightscout database.",
                    fontSize: "26dp",
                    color: "#FFFF00",
                    textAlign: "center",
                  },
                ],
              },
            },
          })
          .getResponse();
      }

      const entries = response.data.reverse();
      // isMmol is already defined above

      const lastEntry = entries[entries.length - 1];
      const lastReading = isMmol
        ? `${(lastEntry.sgv / 18).toFixed(1)} ${unit}`
        : `${lastEntry.sgv} ${unit}`;

      // Get trend icon and text
      const trend = getTrendIndicator(entries, isMmol);

      const lastUpdated =
        lastEntry.date && !isNaN(new Date(lastEntry.date).getTime())
          ? formatTimeWithTimezone(new Date(lastEntry.date), timezone)
          : "Unknown";

      const firstEntry = entries[0];
      const timeRange = `${Math.round(
        (new Date(lastEntry.date) - new Date(firstEntry.date)) / (1000 * 60 * 60)
      )}h`;

      // Generate reading components
      const readingComponents = generateReadingComponents(
        entries,
        isMmol,
        timezone
      );

      if (supportedInterfaces["Alexa.Presentation.APL"]) {
        return handlerInput.responseBuilder
          .addDirective({
            type: "Alexa.Presentation.APL.RenderDocument",
            document: APL_DOCUMENT,
            datasources: {
              data: {
                lastReading: lastReading,
                trendIndicatorIcon: trend.icon, // Pass icon separately
                trendText: trend.text, // Pass text separately
                lastUpdated: lastUpdated,
                timeRange: timeRange,
                readingsList: readingComponents,
                targetRangeText: targetRangeText, // Pass new property
              },
            },
          })
          .withShouldEndSession(false) // KEEP THE SESSION OPEN
          .getResponse();
      }

      // Fallback for non-APL devices (shouldn't happen on Echo Show but good practice)
      const speechOutput = `Current glucose is ${lastReading}. Trend is ${trend.text}. Last updated ${lastUpdated}.`;
      return handlerInput.responseBuilder
        .speak(speechOutput)
        .withShouldEndSession(false) // KEEP THE SESSION OPEN
        .getResponse();
    } catch (error) {
      console.error("[ERROR] DISPLAY GRAPH HANDLER Error:", error.message);
      return handlerInput.responseBuilder
        .addDirective({
          type: "Alexa.Presentation.APL.RenderDocument",
          document: APL_DOCUMENT,
          datasources: {
            data: {
              lastReading: "System Error",
              trendIndicatorIcon: "❌",
              trendText: "Error",
              lastUpdated: "System malfunction",
              timeRange: "",
              targetRangeText: "", // Keep empty on error
              readingsList: [
                {
                  type: "Text",
                  text: "SYSTEM ERROR",
                  fontSize: "28dp",
                  color: "#FF0000",
                  textAlign: "center",
                  paddingBottom: "10dp",
                },
                {
                  type: "Text",
                  text: "An unexpected error occurred.",
                  fontSize: "26dp",
                  color: "#FFFF00",
                  textAlign: "center",
                },
                {
                  type: "Text",
                  text: "Please try again later.",
                  fontSize: "26dp",
                  color: "#FFFF00",
                  textAlign: "center",
                },
              ],
            },
          },
        })
        .withShouldEndSession(false) // KEEP THE SESSION OPEN
        .getResponse();
    }
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.HelpIntent"
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("You can say, 'Display graph' to see your Nightscout data.")
      .withShouldEndSession(false)
      .getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      (Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "AMAZON.CancelIntent" ||
        Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.StopIntent")
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("Goodbye!")
      .withShouldEndSession(true)
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "SessionEndedRequest"
    );
  },
  handle(handlerInput) {
    console.log(
      `[LOG] Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`
    );
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`[ERROR] Error handled: ${error?.message || "Unknown error"}`);
    return handlerInput.responseBuilder
      .addDirective({
        type: "Alexa.Presentation.APL.RenderDocument",
        document: APL_DOCUMENT,
        datasources: {
          data: {
            lastReading: "Handler Error",
            trendIndicatorIcon: "❌",
            trendText: "Error",
            lastUpdated: "Error in error handler",
            timeRange: "",
            targetRangeText: "", // Keep empty on error
            readingsList: [
              {
                type: "Text",
                text: "ERROR HANDLER TRIGGERED",
                fontSize: "28dp",
                color: "#FF0000",
                textAlign: "center",
                paddingBottom: "10dp",
              },
              {
                type: "Text",
                text: "Something went wrong processing",
                fontSize: "26dp",
                color: "#FFFF00",
                textAlign: "center",
              },
              {
                type: "Text",
                text: "your request.",
                fontSize: "26dp",
                color: "#FFFF00",
                textAlign: "center",
              },
            ],
          },
        },
      })
      .withShouldEndSession(false) // KEEP THE SESSION OPEN
      .getResponse();
  },
};

export const handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    DisplayGraphIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
