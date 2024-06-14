import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as config from 'config';
import * as fs from 'fs';

export class VaultCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'my-vpc', {
      subnetConfiguration: [
         {
           cidrMask: 24,
           name: 'ingress',
           subnetType: ec2.SubnetType.PUBLIC,
         }
      ]
    })

    const configProp: {
      zoneName: string,
      zoneId: string
    } = config.get('vault');

    const bootstrap = fs.readFileSync(`./lib/vaultServer_UserData.txt`, 'utf-8');
    const userDataCommands = ec2.UserData.forLinux({
      shebang: '#!/bin/bash -xe'
    });
    userDataCommands.addCommands(
      bootstrap,
    );
    const handle = new ec2.InitServiceRestartHandle();
    const machineImage = ec2.MachineImage.latestAmazonLinux2();

    // Create KMS key for auto-unseal
    const vaultKmsKey = new kms.Key(this, 'VaultAutoUnsealKey', {
      description: 'Vault unseal key',
      alias: 'vault-kms-unseal-key',
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const vaultConfigTmp = fs.readFileSync('./files/vault_config.hcl', 'utf-8');
    const vaultConfig = vaultConfigTmp.replace(/KMS_ID/gi, vaultKmsKey.keyId);

    // Create an IAM role for the EC2 instance
    const vaultRole = new iam.Role(this, 'VaultInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    vaultRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));

    const vaultServer = new ec2.Instance(this, 'vaultServer', {
      instanceType: new ec2.InstanceType('t3.micro'),
      machineImage: machineImage,
      vpc: vpc,
      role: vaultRole,
      userData: userDataCommands,
      /**
       * CloudFormation Init and InitOption (Optional)
       */
      init: ec2.CloudFormationInit.fromConfigSets({
        configSets: {
          default: ['vaultInit']
        },
        configs: {
          vaultInit: new ec2.InitConfig([
            ec2.InitFile.fromString('/etc/consul.d/ui.json',
              fs.readFileSync('./files/consul_ui.json', 'utf-8')),
            ec2.InitFile.fromString('/etc/systemd/system/consul.service',
              fs.readFileSync('./files/consul_systemd', 'utf-8')),
            ec2.InitFile.fromString('/etc/vault/config.hcl', vaultConfig),
            ec2.InitFile.fromString('/etc/systemd/system/vault.service',
              fs.readFileSync('./files/vault_systemd', 'utf-8')),
            ec2.InitCommand.shellCommand('sudo systemctl daemon-reload'),
            ec2.InitService.enable('consul', { serviceRestartHandle: handle }),
            ec2.InitService.enable('vault', { serviceRestartHandle: handle }),
          ])
        }
      }),
    })

    // vaultServer.connections.allowFromAnyIpv4(ec2.Port.tcp(22))
    vaultServer.connections.allowFromAnyIpv4(ec2.Port.tcp(8200))
    /**
     * Allow only specific IP or IP range (alternative to above Allow From Any)
     */    
    // vaultServer.connections.allowFrom(ec2.Peer.ipv4('103.137.12.0/24'), ec2.Port.tcp(8200))

    const vaultRecordSet = new route53.RecordSet(this, 'vaultRecordSet', {
      recordType: route53.RecordType.A,
      target: route53.RecordTarget.fromValues(vaultServer.instancePublicIp),      
      zone: route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId: configProp.zoneId,
        zoneName: configProp.zoneName,
      }),
    });

    new cdk.CfnOutput(this, 'vaultPublicIp', {
      value: vaultServer.instancePublicIp,
      description: 'Public IP of Instance'
    });
    new cdk.CfnOutput(this, 'vaultDNSUrl', {
      value: vaultRecordSet.domainName,
      description: 'Domain Name of Instance'
    });
  }
}
