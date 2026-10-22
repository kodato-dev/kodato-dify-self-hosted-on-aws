import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { DifyOnAwsStack } from '../lib/dify-on-aws-stack';

test.each([
  { overrides: {}, cpu: '2048', memory: '4096' },
  { overrides: { apiServiceCpu: 4096, apiServiceMemoryLimitMiB: 8192 }, cpu: '4096', memory: '8192' },
])('API task preserves the fork size or accepts explicit overrides: %j', ({ overrides, cpu, memory }) => {
  const app = new cdk.App();
  const stack = new DifyOnAwsStack(app, 'TestStack', {
    env: { region: 'us-west-2', account: '123456789012' },
    useCloudFront: false,
    ...overrides,
  });
  const template = Template.fromStack(stack);
  template.hasResourceProperties('AWS::ECS::TaskDefinition', {
    Cpu: cpu,
    Memory: memory,
    ContainerDefinitions: Match.arrayWith([
      Match.objectLike({ Name: 'Main', Environment: Match.arrayWith([{ Name: 'MODE', Value: 'api' }]) }),
    ]),
  });
});
