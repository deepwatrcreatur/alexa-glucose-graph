import * as Alexa from "ask-sdk-core";
import axios from "axios";
import crypto from "crypto";

// APL document with component-based layout
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
        paddingTop: "20dp",
        backgroundColor: "#000000",
        items: [
          {
            type: "Text",
            text: "🩸 Nightscout Monitor",
            fontSize: "32dp",
            color: "#FFFFFF",
            textAlign: "center",
            paddingBottom: "20dp",
          },
          {
            type: "Container",
            direction: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingBottom: "15dp",
            items: [
              {
                type: "Text",
                text: "Current: ",
                fontSize: "24dp",
                color: "#CCCCCC",
              },
              {
                type: "Text",
                text: "${data.lastReading}",
                fontSize: "32dp",
                color: "#00FF00",
                fontWeight: "bold",
              },
            ],
          },
          {
            type: "Text",
            text: "${data.trendIndicator}",
            fontSize: "24dp",
            color: "#FFFF00",
            textAlign: "center",
            paddingBottom: "10dp",
          },
          {
            type: "Text",
            text: "Updated: ${data.lastUpdated}",
            fontSize: "18dp",
            color: "#FFFF00",
            textAlign: "center",
            paddingBottom: "20dp",
          },
          {
            type: "Container",
            width: "95vw",
            height: "450dp",
            backgroundColor: "#111111",
            borderWidth: "2dp",
            borderColor: "#333333",
            borderRadius: "10dp",
            padding: "20dp",
            items: [
              {
                type: "Text",
                text: "📊 Glucose Trend - Last ${data.timeRange}",
                fontSize: "20dp",
                color: "#FFFFFF",
                textAlign: "center",
                paddingBottom: "20dp",
              },
              {
                type: "ScrollView",
                width: "100%",
                height: "350dp",
                items: [
                  {
                    type: "Container",
                    direction: "column",
                    items: "${data.readingsList}"
                  }
                ],
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
        fontSize: "18dp",
        color: "#FF0000"
      }
    ];
  }

  const recentEntries = entries.slice(-8);
  const unit = isMmol ? "mmol/L" : "mg/dL";
  const targetRange = isMmol ? [4, 10] : [80, 180];

  let components = [];
  
  // Header
  components.push({
    type: "Text",
    text: `TARGET RANGE: ${targetRange[0]}-${targetRange[1]} ${unit}`,
    fontSize: "16dp",
    color: "#FFFFFF",
    textAlign: "center",
    paddingBottom: "15dp"
  });

  // Each reading as separate component
  recentEntries.reverse().forEach((entry, index) => {
    const value = isMmol ? (entry.sgv / 18).toFixed(1) : entry.sgv;
    const numericValue = isMmol ? entry.sgv / 18 : entry.sgv;
    
    const date = new Date(entry.date);
    const time = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone,
    });

    // Status
    let indicator = "";
    let valueColor = "#00FFFF";
    if (numericValue < targetRange[0]) {
      indicator = "🔻";
      valueColor = "#FF6B6B";
    } else if (numericValue > targetRange[1]) {
      indicator = "🔺";
      valueColor = "#FFB347";
    } else {
      indicator = "✅";
      valueColor = "#90EE90";
    }

    // Trend arrow
    let trend = "";
    if (index > 0) {
      const prevEntry = recentEntries[recentEntries.length - index];
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
      paddingBottom: "8dp",
      paddingLeft: "10dp",
      paddingRight: "10dp",
      items: [
        {
          type: "Text",
          text: time,
          fontSize: "16dp",
          color: "#CCCCCC",
          width: "80dp"
        },
        {
          type: "Text",
          text: indicator,
          fontSize: "18dp",
          width: "30dp",
          textAlign: "center"
        },
        {
          type: "Text",
          text: `${value} ${unit}`,
          fontSize: "16dp",
          color: valueColor,
          textAlign: "right",
          width: "100dp"
        },
        {
          type: "Text",
          text: trend,
          fontSize: "16dp",
          color: "#FFFF00",
          width: "25dp",
          textAlign: "center"
        }
      ]
    });
  });

  // Legend
  components.push({
    type: "Text",
    text: "🔺 High   ✅ Normal   🔻 Low",
    fontSize: "14dp",
    color: "#FFFFFF",
    textAlign: "center",
    paddingTop: "15dp"
  });

  components.push({
    type: "Text",
    text: "↗ Rising   → Stable   ↘ Falling",
    fontSize: "14dp",
    color: "#FFFF00",
    textAlign: "center",
    paddingTop: "5dp"
  });

  return components;
}

// Helper function to determine trend
function getTrendIndicator(entries, isMmol) {
  if (entries.length < 2) return "📊 Single Reading";

  const current = isMmol
    ? entries[entries.length - 1].sgv / 18
    : entries[entries.length - 1].sgv;
  const previous = isMmol
    ? entries[entries.length - 2].sgv / 18
    : entries[entries.length - 2].sgv;

  const diff = current - previous;
  const threshold = isMmol ? 0.3 : 5;

  if (diff > threshold) {
    return "📈 Rising";
  } else if (diff < -threshold) {
    return "📉 Falling";
  } else {
    return "➡️ Stable";
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
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest";
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

      if (!nightscoutUrl || !apiSecret) {
        return handlerInput.responseBuilder
          .addDirective({
            type: "Alexa.Presentation.APL.RenderDocument",
            document: APL_DOCUMENT,
            datasources: {
              data: {
                lastReading: "Configuration Error",
                trendIndicator: "❌ Setup Required",
                lastUpdated: "Missing environment variables",
                timeRange: "Config Error",
                readingsList: [
                  {
                    type: "Text",
                    text: "CONFIGURATION REQUIRED:",
                    fontSize: "18dp",
                    color: "#FF0000",
                    textAlign: "center",
                    paddingBottom: "10dp"
                  },
                  {
                    type: "Text",
                    text: "• Set NIGHTSCOUT_URL",
                    fontSize: "16dp",
                    color: "#FFFF00"
                  },
                  {
                    type: "Text",
                    text: "• Set NIGHTSCOUT_API_SECRET",
                    fontSize: "16dp",
                    color: "#FFFF00"
                  },
                  {
                    type: "Text",
                    text: "• Set UNIT_TYPE (mmol or mg)",
                    fontSize: "16dp",
                    color: "#FFFF00"
                  },
                  {
                    type: "Text",
                    text: "• Set TIMEZONE",
                    fontSize: "16dp",
                    color: "#FFFF00"
                  }
                ]
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
      const entryCount = 15;

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
                trendIndicator: "❌ Connection Failed",
                lastUpdated: "Unable to fetch data",
                timeRange: "Connection Error",
                readingsList: [
                  {
                    type: "Text",
                    text: "CONNECTION ERROR:",
                    fontSize: "18dp",
                    color: "#FF0000",
                    textAlign: "center",
                    paddingBottom: "10dp"
                  },
                  {
                    type: "Text",
                    text: apiError.message,
                    fontSize: "14dp",
                    color: "#FFFF00",
                    textAlign: "center"
                  },
                  {
                    type: "Text",
                    text: "Check:",
                    fontSize: "16dp",
                    color: "#FFFFFF",
                    paddingTop: "10dp"
                  },
                  {
                    type: "Text",
                    text: "• Nightscout URL is correct",
                    fontSize: "14dp",
                    color: "#FFFF00"
                  },
                  {
                    type: "Text",
                    text: "• API secret is valid",
                    fontSize: "14dp",
                    color: "#FFFF00"
                  },
                  {
                    type: "Text",
                    text: "• Internet connection",
                    fontSize: "14dp",
                    color: "#FFFF00"
                  }
                ]
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
                trendIndicator: "❌ No Readings",
                lastUpdated: "No recent entries found",
                timeRange: "No Data",
                readingsList: [
                  {
                    type: "Text",
                    text: "NO DATA AVAILABLE",
                    fontSize: "18dp",
                    color: "#FF0000",
                    textAlign: "center",
                    paddingBottom: "10dp"
                  },
                  {
                    type: "Text",
                    text: "No recent glucose readings found",
                    fontSize: "16dp",
                    color: "#FFFF00",
                    textAlign: "center"
                  },
                  {
                    type: "Text",
                    text: "in your Nightscout database.",
                    fontSize: "16dp",
                    color: "#FFFF00",
                    textAlign: "center"
                  }
                ]
              },
            },
          })
          .getResponse();
      }

      const entries = response.data.reverse();
      const isMmol = unitType.toLowerCase() === "mmol";

      const lastEntry = entries[entries.length - 1];
      const lastReading = isMmol
        ? `${(lastEntry.sgv / 18).toFixed(1)} mmol/L`
        : `${lastEntry.sgv} mg/dL`;

      const trendIndicator = getTrendIndicator(entries, isMmol);

      const lastUpdated =
        lastEntry.date && !isNaN(new Date(lastEntry.date).getTime())
          ? formatTimeWithTimezone(new Date(lastEntry.date), timezone)
          : "Unknown";

      const firstEntry = entries[0];
      const timeRange = `${Math.round(
        (new Date(lastEntry.date) - new Date(firstEntry.date)) / (1000 * 60 * 60)
      )}h`;

      // Generate reading components
      const readingComponents = generateReadingComponents(entries, isMmol, timezone);

      if (supportedInterfaces["Alexa.Presentation.APL"]) {
        return handlerInput.responseBuilder
          .addDirective({
            type: "Alexa.Presentation.APL.RenderDocument",
            document: APL_DOCUMENT,
            datasources: {
              data: {
                lastReading: lastReading,
                trendIndicator: trendIndicator,
                lastUpdated: lastUpdated,
                timeRange: timeRange,
                readingsList: readingComponents,
              },
            },
          })
          .getResponse();
      }

      return handlerInput.responseBuilder.getResponse();
    } catch (error) {
      console.error("[ERROR] DISPLAY GRAPH HANDLER Error:", error.message);
      return handlerInput.responseBuilder
        .addDirective({
          type: "Alexa.Presentation.APL.RenderDocument",
          document: APL_DOCUMENT,
          datasources: {
            data: {
              lastReading: "System Error",
              trendIndicator: "❌ Error",
              lastUpdated: "System malfunction",
              timeRange: "Error",
              readingsList: [
                {
                  type: "Text",
                  text: "SYSTEM ERROR",
                  fontSize: "18dp",
                  color: "#FF0000",
                  textAlign: "center",
                  paddingBottom: "10dp"
                },
                {
                  type: "Text",
                  text: "An unexpected error occurred.",
                  fontSize: "16dp",
                  color: "#FFFF00",
                  textAlign: "center"
                },
                {
                  type: "Text",
                  text: "Please try again later.",
                  fontSize: "16dp",
                  color: "#FFFF00",
                  textAlign: "center"
                }
              ]
            },
          },
        })
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
    return handlerInput.responseBuilder.getResponse();
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
    return handlerInput.responseBuilder.getResponse();
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
            trendIndicator: "❌ Error",
            lastUpdated: "Error in error handler",
            timeRange: "Error",
            readingsList: [
              {
                type: "Text",
                text: "ERROR HANDLER TRIGGERED",
                fontSize: "18dp",
                color: "#FF0000",
                textAlign: "center",
                paddingBottom: "10dp"
              },
              {
                type: "Text",
                text: "Something went wrong processing",
                fontSize: "16dp",
                color: "#FFFF00",
                textAlign: "center"
              },
              {
                type: "Text",
                text: "your request.",
                fontSize: "16dp",
                color: "#FFFF00",
                textAlign: "center"
              }
            ]
          },
        },
      })
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
