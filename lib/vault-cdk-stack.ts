import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
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

    const configProd: {
      zoneName: string,
      zoneId: string
    } = config.get('vault');

    const myKey = new ec2.CfnKeyPair(this, 'myKey', {
      keyName: 'carlli-key',
      publicKeyMaterial: fs.readFileSync(`./lib/id_rsa.pub`, 'utf-8')
    });

    const bootstrap = fs.readFileSync(`./lib/vaultServer_UserData.txt`, 'utf-8');
    const userDataCommands = ec2.UserData.forLinux({
      shebang: '#!/bin/bash -xe'
    });
    userDataCommands.addCommands(
      bootstrap,
    );
    const handle = new ec2.InitServiceRestartHandle();
    const machineImage = ec2.MachineImage.latestAmazonLinux2();

    const vaultServer = new ec2.Instance(this, 'vaultServer', {
      instanceType: new ec2.InstanceType('t3.micro'),
      machineImage: machineImage,
      vpc: vpc,
      keyName: myKey.keyName,
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
            ec2.InitFile.fromString('/etc/vault/config.hcl',
              fs.readFileSync('./files/vault_config.hcl', 'utf-8')),
            ec2.InitFile.fromString('/etc/systemd/system/vault.service',
              fs.readFileSync('./files/vault_systemd', 'utf-8')),
            ec2.InitCommand.shellCommand('sudo systemctl daemon-reload'),
            ec2.InitService.enable('consul', { serviceRestartHandle: handle }),
            ec2.InitService.enable('vault', { serviceRestartHandle: handle }),
          ])
        }
      }),
    })

    vaultServer.connections.allowFromAnyIpv4(ec2.Port.tcp(22))
    vaultServer.connections.allowFromAnyIpv4(ec2.Port.tcp(80))
    /**
     * Allow only specific IP or IP range (alternative to above Allow From Any)
     */    
    // vaultServer.connections.allowFrom(ec2.Peer.ipv4('103.137.12.0/24'), ec2.Port.tcp(22))
    // vaultServer.connections.allowFrom(ec2.Peer.ipv4('103.137.12.0/24'), ec2.Port.tcp(80))

    const vaultRecordSet = new route53.RecordSet(this, 'vaultRecordSet', {
      recordType: route53.RecordType.A,
      target: route53.RecordTarget.fromValues(vaultServer.instancePublicIp),      
      zone: route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId: configProd.zoneId,
        zoneName: configProd.zoneName,
      }),
    });

    new cdk.CfnOutput(this, 'vaultPublicIp', {
      value: vaultServer.instancePublicIp,
      description: 'Public IP of Instance'
    });
  }
}
