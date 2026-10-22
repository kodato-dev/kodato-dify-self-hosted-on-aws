import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ContainerImage } from 'aws-cdk-lib/aws-ecs';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { DifyOnAwsStack } from '../lib/dify-on-aws-stack';

function synth(patched: boolean, customEcrRepositoryName?: string) {
  const app = new cdk.App();
  const stack = new DifyOnAwsStack(app, 'TestStack', {
    env: { region: 'us-west-2', account: '123456789012' },
    difyImageTag: '1.13.3',
    difyPluginDaemonImageTag: '0.5.5-local',
    difySandboxImageTag: '0.2.4',
    useCloudFront: false,
    customEcrRepositoryName,
    difyWebImage: patched
      ? ContainerImage.fromAsset(path.join(__dirname, '../lib/constructs/dify-services/docker/web'), {
          platform: Platform.LINUX_AMD64,
        })
      : undefined,
  });
  return Template.fromStack(stack).toJSON();
}

test.each([undefined, 'dify-images'])(
  'the runtime patch changes only the Web image and its pull permissions (repository: %s)',
  (repositoryName) => {
    const baseline = synth(false, repositoryName);
    const patched = synth(true, repositoryName);
    expect(Object.keys(patched.Resources)).toEqual(Object.keys(baseline.Resources));
    const changes = Object.keys(baseline.Resources).filter(
      (key) => JSON.stringify(baseline.Resources[key]) !== JSON.stringify(patched.Resources[key]),
    );
    expect(changes).toHaveLength(2);
    const webTaskId = changes.find((key) => patched.Resources[key].Type === 'AWS::ECS::TaskDefinition')!;
    const policyId = changes.find((key) => patched.Resources[key].Type === 'AWS::IAM::Policy')!;
    expect(webTaskId).toMatch(/^WebService/);
    expect(policyId).toMatch(/^WebService/);
    const oldTask = baseline.Resources[webTaskId];
    const newTask = patched.Resources[webTaskId];
    expect(JSON.stringify(oldTask.Properties.ContainerDefinitions[0].Image)).toContain(
      repositoryName ? 'dify-web_1.13.3' : 'langgenius/dify-web:1.13.3',
    );
    expect(JSON.stringify(newTask.Properties.ContainerDefinitions[0].Image)).toContain(
      'cdk-hnb659fds-container-assets',
    );
    newTask.Properties.ContainerDefinitions[0].Image = oldTask.Properties.ContainerDefinitions[0].Image;
    expect(newTask).toEqual(oldTask);
    expect(patched.Outputs).toEqual(baseline.Outputs);
  },
);
