import * as Alexa from "ask-sdk-core";
import axios from "axios";
import https from "https";

// Your APL document is defined here. It includes an AutoPage command
// to refresh the data every 5 minutes (300000 ms).
const APL_DOCUMENT_ID = "NightscoutGraphAPL";
const APL_DOCUMENT = {
  type: "APL",
  version: "2024.2",
  mainTemplate: {
    parameters: ["payload"],
    items: [
      {
        type: "Container",
        width: "100vw",
        height: "100vh",
        alignItems: "center",
        justifyContent: "center",
        items: [
          {
            type: "Image",
            source: "${payload.graphUrl}",
            scale: "best-fit",
            width: "95vw",
            height: "95vh",
            align: "center",
          },
          {
            type: "Text",
            text: "Last updated: ${payload.timestamp}",
            position: "absolute",
            bottom: "8px",
            right: "24px",
            color: "gray",
            fontSize: "24px",
          },
        ],
      },
    ],
  },
  onMount: [
    {
      type: "AutoPage",
      componentId: "pager",
      duration: 300000, // Refresh every 5 minutes
    },
  ],
};

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest";
  },
  handle(handlerInput) {
    // When the skill is launched, immediately try to display the graph.
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
    try {
      // 1. Fetch data from Nightscout
      const nightscoutUrl = process.env.NIGHTSCOUT_URL;
      const apiSecret = process.env.NIGHTSCOUT_API_SECRET;
      const entryCount = 48; // Get last 4 hours of data (48 * 5 mins)

      // Create a custom HTTPS agent that ignores self-signed certificate errors
      const agent = new https.Agent({
        rejectUnauthorized: false,
      });

      const response = await axios.get(
        `${nightscoutUrl}/api/v1/entries.json?count=${entryCount}`,
        {
          headers: { "api-secret": apiSecret },
          httpsAgent: agent, // <-- ADD THIS LINE
        },
      );
     
      if (response.data.length === 0) {
        return handlerInput.responseBuilder
          .speak("I couldn't find any recent data in your Nightscout site.")
          .getResponse();
      }

      // 2. Process data for the chart
      // Data comes in reverse chronological order, so we reverse it.
      const entries = response.data.reverse();
      const sgvData = entries.map((entry) => entry.sgv);
      const labels = entries.map((entry, index) => {
        // Only label every 6th point (every 30 mins) to avoid clutter
        if (index % 6 === 0) {
          const date = new Date(entry.date);
          return date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          });
        }
        return "";
      });

      // 3. Build the chart URL using image-charts.com
      const chartConfig = {
        cht: "lc", // Line chart
        chs: "800x450", // Chart size
        chd: `t:${sgvData.join(",")}`, // Chart data
        chxt: "x,y", // Show X and Y axes
        chxl: `0:|${labels.join("|")}`, // X-axis labels
        chxr: "1,40,400", // Y-axis range
        chg: "0,12.5,1,4", // Grid lines
        chco: "3498DB", // Line color
        chls: "3", // Line thickness
        chm: "o,3498DB,0,-1,5", // Markers on data points
        // Horizontal lines for target range
        chm_1: "r,FF0000,0,0.74,0.76", // High line at 180
        chm_2: "r,00FF00,0,0.24,0.26", // Low line at 70
      };

      const chartUrl = `https://image-charts.com/chart?${new URLSearchParams(
        chartConfig,
      ).toString()}`;

      const lastEntry = entries[entries.length - 1];
      const lastUpdated = new Date(lastEntry.date).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });

      // 4. Send the APL directive to the Echo Show
      if (Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)["Alexa.Presentation.APL"]) {
        handlerInput.responseBuilder.addDirective({
          type: "Alexa.Presentation.APL.RenderDocument",
          document: APL_DOCUMENT,
          datasources: {
            payload: {
              graphUrl: chartUrl,
              timestamp: lastUpdated,
            },
          },
        });
      }

      // Provide a verbal confirmation
      const latestSgv = lastEntry.sgv;
      const trend = lastEntry.direction;
      const speakOutput = `Your latest reading is ${latestSgv}, trend is ${trend}.`;

      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    } catch (error) {
      console.error("Error in DisplayGraphIntentHandler:", error);
      const speakOutput =
        "Sorry, I had trouble connecting to your Nightscout site. Please check the Lambda logs for more information.";
      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }
  },
};

// Standard handlers
const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.HelpIntent"
    );
  },
  handle(handlerInput) {
    const speakOutput = "You can ask me to show your graph. For example, say 'show my graph'.";
    return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      (Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.CancelIntent" ||
        Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.StopIntent")
    );
  },
  handle(handlerInput) {
    const speakOutput = "Goodbye!";
    return handlerInput.responseBuilder.speak(speakOutput).getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "SessionEndedRequest";
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);
    const speakOutput = "Sorry, I encountered an error. Please try again.";
    return handlerInput.responseBuilder.speak(speakOutput).reprompt(speakOutput).getResponse();
  },
};

export const handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    DisplayGraphIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler,
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
