This is code for an Alexa skill that retrieves glucose measurements from a nightscout instance, and displays a graph on an Alex Echo Show. There are 3 environmental variables used by the AWS lambda function:

NIGHTSCOUT_URL
NIGHTSCOUT_API_SECRET
UNIT_TYPE

The units are either mmol (by default) or mgdl, and the setting is case insensitive
