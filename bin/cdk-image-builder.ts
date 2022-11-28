#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CdkImageBuilderStack } from '../lib/cdk-image-builder-stack';
import { BasicOptions } from '../types';
const app = new cdk.App();

const appProps: BasicOptions = {
   version: "1.0.2",
   projectName: "VP"
}

new CdkImageBuilderStack(app, `${appProps.projectName}GoldenImageCDK`, appProps, {
   env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: 'ap-northeast-1'
   },
});