# Alexa Nightscout Skill

This Alexa skill retrieves glucose measurements from a Nightscout instance and displays a graph on an Amazon Echo Show.

## Overview

The skill interfaces with a Nightscout server to fetch real-time glucose data and presents it to users via voice responses and a visual graph on Echo Show devices. It is powered by an AWS Lambda function that processes requests and handles data retrieval.

## Environmental Variables

The AWS Lambda function relies on the following environmental variables:

- **NIGHTSCOUT_URL**: The URL of your Nightscout instance (e.g., `https://your-nightscout.herokuapp.com`).
- **NIGHTSCOUT_API_SECRET**: The API secret key for authenticating with your Nightscout instance.
- **TIMEZONE**: Defaults to UTC (e.g., `America/Toronto`).
- **UNIT_TYPE**: The unit of measurement for glucose values. Options are:
  - `mmol` (default, case-insensitive)
  - `mgdl` (case-insensitive)

## Configuration Notes

- Ensure all environmental variables are set correctly in the AWS Lambda console to avoid runtime errors.
- The `UNIT_TYPE` setting is case-insensitive, so `MMOL`, `mmol`, or `MgDl` are all valid.
- For security, keep the `NIGHTSCOUT_API_SECRET` confidential and do not expose it in public repositories.

## Setup Instructions

1. Deploy the Lambda function code to your AWS account.
2. Configure the environmental variables in the Lambda function settings.
3. Link the skill in the Alexa Developer Console and associate it with the Lambda function ARN.
4. Test the skill on an Echo Show device to verify data retrieval and graph display.

## Contributing

Feel free to open issues or submit pull requests to improve the skill. Ensure any changes are tested with both `mmol` and `mgdl` unit types.

## License

This project is licensed under the Apache 2.0 License. See the [LICENSE](LICENSE) file for details.
