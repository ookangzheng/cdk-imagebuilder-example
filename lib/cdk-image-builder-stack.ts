import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as imagebuilder from 'aws-cdk-lib/aws-imagebuilder';
import { Construct } from 'constructs';
import { BasicOptions } from '../types';

export class CdkImageBuilderStack extends cdk.Stack {
  constructor(scope: Construct, id: string, appProps: BasicOptions, props?: cdk.StackProps) {
    super(scope, id, props);

    const data = `
    name: VPComponent
    description: Install the latest version of VP dependencies
    schemaVersion: 1.0
    phases:
      - name: build
        steps:
          - name: InstallImageBasicDependencies
            action: ExecuteBash
            inputs:
              commands:
                - sudo systemctl stop snap.amazon-ssm-agent.amazon-ssm-agent.service
                - sudo snap refresh amazon-ssm-agent --channel=candidate
                - sudo systemctl start snap.amazon-ssm-agent.amazon-ssm-agent.service
                - sudo apt update -y && sudo apt install python3 wget htop dnsutils nload ncdu curl jq zip unzip git build-essential
                - cd ~/ && curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && sudo unzip awscliv2.zip && ./aws/install && rm -r ./aws
                - cd ~/ && wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb && sudo dpkg -i ./amazon-cloudwatch-agent.deb && rm ./amazon-cloudwatch-agent.deb
          - name: InstallVPDependencies
            action: ExecuteBash
            inputs:
              commands:
                - sudo apt install -y libwww-perl libcrypt-ssleay-perl libswitch-perl
          - name: CleanApt
            action: ExecuteBash
            inputs:
              commands:
                - sudo apt autoremove -y --purge
                - sudo apt clean
    `

    const component = new imagebuilder.CfnComponent(this, 'VPComponent', {
      name: 'VPComponent',
      version: appProps.version,
      description: 'Install the latest version dependencies',
      platform: 'Linux',
      data: data,
    })

    const receipe = new imagebuilder.CfnImageRecipe(this, 'VPImageRecipe', {
      name: 'VPImageRecipe',
      parentImage: 'ami-02ae3dea04b2cb88e',
      version: appProps.version,
      components: [{
        componentArn: component.attrArn
      }],
    })
    receipe.addDependsOn(component)

    const instanceProfileRole = new iam.Role(this, 'VPRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      roleName: 'VPUbuntuEc2Role',
    })
    instanceProfileRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'))
    instanceProfileRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('EC2InstanceProfileForImageBuilder'))

    const instanceProfile = new iam.CfnInstanceProfile(this, 'VPInstanceProfile', {
      instanceProfileName: 'VPUbuntuEc2InstanceProfile',
      roles: [instanceProfileRole.roleName],
      path: "/executionServiceEC2Role/"
    })

    const infraConfig = new imagebuilder.CfnInfrastructureConfiguration(this, 'VPInfrastructureConfiguration', {
      name: 'VPInfrastructureConfiguration',
      instanceProfileName: instanceProfile.instanceProfileName as string,
      instanceTypes: ['t3.medium'],
    })
    infraConfig.addDependsOn(instanceProfile)

    const distributionConfig = new imagebuilder.CfnDistributionConfiguration(this, 'VPDistributionConfiguration', {
      name: 'VPDistributionConfiguration',
      distributions: [
        {
          region: 'ap-northeast-1',
          amiDistributionConfiguration: {
            name: 'VP-Image-{{imagebuilder:buildDate}}',
          }
        }
      ]
    });

    const pipeline = new imagebuilder.CfnImagePipeline(this, 'VPImagePipeline', {
      name: 'VPImagePipeline',
      imageRecipeArn: receipe.attrArn,
      infrastructureConfigurationArn: infraConfig.attrArn,
      distributionConfigurationArn: distributionConfig.attrArn,
    })
    pipeline.addDependsOn(distributionConfig)
    pipeline.addDependsOn(receipe)
    pipeline.addDependsOn(infraConfig)

  }
}
