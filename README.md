# Welcome to Hashicorp Vault CDK project

⚠️ **Warning:** This code is intended for proof of concept purposes only. It is not recommended for production use. Please ensure proper security, error handling, and testing before using any part of this code in a production environment.

This project will create a Hashicorp Open Source Vault EC2 instance in public subnet with integrated Raft storage.  It also will create a Route53 RecordSet

`config/development.yaml` file shows the configuration you will required
- zoneName: _The Route53 public zone name_
- zoneId: _The Route53 zone ID of the public zone_
- existingKmsArn: _(optional) Existing KMS Key for vault auto seal_

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
