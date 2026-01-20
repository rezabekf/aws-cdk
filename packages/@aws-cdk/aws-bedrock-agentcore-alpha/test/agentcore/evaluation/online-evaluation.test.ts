/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as iam from 'aws-cdk-lib/aws-iam';
import {
  OnlineEvaluation,
  EvaluatorReference,
  DataSourceConfig,
  BuiltinEvaluator,
  FilterOperator,
  Runtime,
  AgentRuntimeArtifact,
} from '../../../lib';

describe('OnlineEvaluation', () => {
  let app: App;
  let stack: Stack;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' },
    });
  });

  describe('creation with minimal props', () => {
    test('creates OnlineEvaluation with CloudWatch Logs data source', () => {
      // WHEN
      new OnlineEvaluation(stack, 'TestEvaluation', {
        configName: 'test_evaluation',
        evaluators: [EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS)],
        dataSource: DataSourceConfig.fromCloudWatchLogs({
          logGroupNames: ['/aws/bedrock-agentcore/my-agent'],
          serviceNames: ['my-agent.default'],
        }),
      });

      // THEN
      const template = Template.fromStack(stack);

      // Verify custom resource is created
      template.hasResourceProperties('Custom::BedrockAgentCoreOnlineEvaluation', {});

      // Verify execution role is created
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'bedrock-agentcore.amazonaws.com',
              },
            },
          ],
        },
      });
    });

    test('creates OnlineEvaluation with AgentCore Runtime endpoint data source', () => {
      // GIVEN
      const runtime = new Runtime(stack, 'TestRuntime', {
        runtimeName: 'test_runtime',
        agentRuntimeArtifact: AgentRuntimeArtifact.fromImageUri('123456789012.dkr.ecr.us-east-1.amazonaws.com/my-agent:latest'),
      });
      const endpoint = runtime.addEndpoint('DEFAULT');

      // WHEN
      new OnlineEvaluation(stack, 'TestEvaluation', {
        configName: 'test_evaluation',
        evaluators: [EvaluatorReference.builtin(BuiltinEvaluator.CORRECTNESS)],
        dataSource: DataSourceConfig.fromAgentRuntimeEndpoint(runtime, endpoint),
      });

      // THEN
      const template = Template.fromStack(stack);
      template.hasResourceProperties('Custom::BedrockAgentCoreOnlineEvaluation', {});
    });
  });

  describe('creation with all props', () => {
    test('creates OnlineEvaluation with all options', () => {
      // GIVEN
      const executionRole = new iam.Role(stack, 'ExecutionRole', {
        assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      });

      // WHEN
      new OnlineEvaluation(stack, 'TestEvaluation', {
        configName: 'full_evaluation',
        evaluators: [
          EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS),
          EvaluatorReference.builtin(BuiltinEvaluator.CORRECTNESS),
          EvaluatorReference.builtin(BuiltinEvaluator.FAITHFULNESS),
        ],
        dataSource: DataSourceConfig.fromCloudWatchLogs({
          logGroupNames: ['/aws/bedrock-agentcore/my-agent'],
          serviceNames: ['my-agent.default'],
        }),
        executionRole,
        description: 'Test evaluation configuration',
        samplingPercentage: 25,
        filters: [
          {
            key: 'user.region',
            operator: FilterOperator.EQUALS,
            value: 'us-east-1',
          },
        ],
        sessionTimeoutMinutes: 30,
        enableOnCreate: true,
        tags: {
          Environment: 'test',
        },
      });

      // THEN
      const template = Template.fromStack(stack);
      template.hasResourceProperties('Custom::BedrockAgentCoreOnlineEvaluation', {});
    });
  });

  describe('evaluator references', () => {
    test('creates built-in evaluator reference', () => {
      // WHEN
      const evaluator = EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS);

      // THEN
      expect(evaluator.evaluatorId).toBe('Builtin.Helpfulness');
      expect(evaluator._render()).toEqual({ evaluatorId: 'Builtin.Helpfulness' });
    });

    test('supports all built-in evaluators', () => {
      // THEN
      expect(EvaluatorReference.builtin(BuiltinEvaluator.GOAL_SUCCESS_RATE).evaluatorId).toBe('Builtin.GoalSuccessRate');
      expect(EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS).evaluatorId).toBe('Builtin.Helpfulness');
      expect(EvaluatorReference.builtin(BuiltinEvaluator.CORRECTNESS).evaluatorId).toBe('Builtin.Correctness');
      expect(EvaluatorReference.builtin(BuiltinEvaluator.FAITHFULNESS).evaluatorId).toBe('Builtin.Faithfulness');
      expect(EvaluatorReference.builtin(BuiltinEvaluator.HARMFULNESS).evaluatorId).toBe('Builtin.Harmfulness');
      expect(EvaluatorReference.builtin(BuiltinEvaluator.STEREOTYPING).evaluatorId).toBe('Builtin.Stereotyping');
      expect(EvaluatorReference.builtin(BuiltinEvaluator.REFUSAL).evaluatorId).toBe('Builtin.Refusal');
      expect(EvaluatorReference.builtin(BuiltinEvaluator.TOOL_SELECTION_ACCURACY).evaluatorId).toBe('Builtin.ToolSelectionAccuracy');
      expect(EvaluatorReference.builtin(BuiltinEvaluator.TOOL_PARAMETER_ACCURACY).evaluatorId).toBe('Builtin.ToolParameterAccuracy');
      expect(EvaluatorReference.builtin(BuiltinEvaluator.COHERENCE).evaluatorId).toBe('Builtin.Coherence');
      expect(EvaluatorReference.builtin(BuiltinEvaluator.RESPONSE_RELEVANCE).evaluatorId).toBe('Builtin.ResponseRelevance');
      expect(EvaluatorReference.builtin(BuiltinEvaluator.CONCISENESS).evaluatorId).toBe('Builtin.Conciseness');
      expect(EvaluatorReference.builtin(BuiltinEvaluator.INSTRUCTION_FOLLOWING).evaluatorId).toBe('Builtin.InstructionFollowing');
    });
  });

  describe('data source configurations', () => {
    test('creates CloudWatch Logs data source', () => {
      // WHEN
      const dataSource = DataSourceConfig.fromCloudWatchLogs({
        logGroupNames: ['/aws/log-group-1', '/aws/log-group-2'],
        serviceNames: ['service-1', 'service-2'],
      });

      // THEN
      expect(dataSource._render()).toEqual({
        cloudWatchLogs: {
          logGroupNames: ['/aws/log-group-1', '/aws/log-group-2'],
          serviceNames: ['service-1', 'service-2'],
        },
      });
    });

    test('creates AgentCore Runtime endpoint data source', () => {
      // GIVEN
      const runtime = new Runtime(stack, 'TestRuntime', {
        runtimeName: 'my_runtime',
        agentRuntimeArtifact: AgentRuntimeArtifact.fromImageUri('123456789012.dkr.ecr.us-east-1.amazonaws.com/my-agent:latest'),
      });
      const endpoint = runtime.addEndpoint('PROD');

      // WHEN
      const dataSource = DataSourceConfig.fromAgentRuntimeEndpoint(runtime, endpoint);

      // THEN
      const rendered = dataSource._render();
      expect(rendered.cloudWatchLogs).toBeDefined();
      expect(rendered.cloudWatchLogs.logGroupNames).toHaveLength(1);
      expect(rendered.cloudWatchLogs.logGroupNames[0]).toContain('/aws/bedrock-agentcore/runtimes/');
      expect(rendered.cloudWatchLogs.logGroupNames[0]).toContain('-PROD');
      expect(rendered.cloudWatchLogs.serviceNames).toEqual(['my_runtime.PROD']);
    });

    test('creates AgentCore Runtime endpoint data source with DEFAULT endpoint', () => {
      // GIVEN
      const runtime = new Runtime(stack, 'TestRuntime', {
        runtimeName: 'test_agent',
        agentRuntimeArtifact: AgentRuntimeArtifact.fromImageUri('123456789012.dkr.ecr.us-east-1.amazonaws.com/my-agent:latest'),
      });
      const endpoint = runtime.addEndpoint('DEFAULT');

      // WHEN
      const dataSource = DataSourceConfig.fromAgentRuntimeEndpoint(runtime, endpoint);

      // THEN
      const rendered = dataSource._render();
      expect(rendered.cloudWatchLogs.serviceNames).toEqual(['test_agent.DEFAULT']);
    });

    test('creates AgentCore Runtime endpoint data source with default endpoint when not specified', () => {
      // GIVEN
      const runtime = new Runtime(stack, 'TestRuntime', {
        runtimeName: 'test_agent',
        agentRuntimeArtifact: AgentRuntimeArtifact.fromImageUri('123456789012.dkr.ecr.us-east-1.amazonaws.com/my-agent:latest'),
      });

      // WHEN - no endpoint passed, should default to 'DEFAULT'
      const dataSource = DataSourceConfig.fromAgentRuntimeEndpoint(runtime);

      // THEN
      const rendered = dataSource._render();
      expect(rendered.cloudWatchLogs.serviceNames).toEqual(['test_agent.DEFAULT']);
      expect(rendered.cloudWatchLogs.logGroupNames[0]).toContain('-DEFAULT');
    });

    test('creates AgentCore Runtime endpoint data source with endpoint name as string', () => {
      // GIVEN
      const runtime = new Runtime(stack, 'TestRuntime', {
        runtimeName: 'test_agent',
        agentRuntimeArtifact: AgentRuntimeArtifact.fromImageUri('123456789012.dkr.ecr.us-east-1.amazonaws.com/my-agent:latest'),
      });

      // WHEN - endpoint name passed as string
      const dataSource = DataSourceConfig.fromAgentRuntimeEndpoint(runtime, 'PROD');

      // THEN
      const rendered = dataSource._render();
      expect(rendered.cloudWatchLogs.serviceNames).toEqual(['test_agent.PROD']);
      expect(rendered.cloudWatchLogs.logGroupNames[0]).toContain('-PROD');
    });
  });

  describe('validation', () => {
    test('throws error for invalid config name - starts with number', () => {
      // THEN
      expect(() => {
        new OnlineEvaluation(stack, 'TestEvaluation', {
          configName: '123invalid',
          evaluators: [EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS)],
          dataSource: DataSourceConfig.fromCloudWatchLogs({
            logGroupNames: ['/aws/log-group'],
            serviceNames: ['service'],
          }),
        });
      }).toThrow(/does not match required pattern/);
    });

    test('throws error for config name too long', () => {
      // THEN
      expect(() => {
        new OnlineEvaluation(stack, 'TestEvaluation', {
          configName: 'a'.repeat(49),
          evaluators: [EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS)],
          dataSource: DataSourceConfig.fromCloudWatchLogs({
            logGroupNames: ['/aws/log-group'],
            serviceNames: ['service'],
          }),
        });
      }).toThrow(/at most 48 characters/);
    });

    test('throws error for empty evaluators array', () => {
      // THEN
      expect(() => {
        new OnlineEvaluation(stack, 'TestEvaluation', {
          configName: 'test_evaluation',
          evaluators: [],
          dataSource: DataSourceConfig.fromCloudWatchLogs({
            logGroupNames: ['/aws/log-group'],
            serviceNames: ['service'],
          }),
        });
      }).toThrow(/At least 1 evaluator is required/);
    });

    test('throws error for too many evaluators', () => {
      // THEN
      expect(() => {
        new OnlineEvaluation(stack, 'TestEvaluation', {
          configName: 'test_evaluation',
          evaluators: Array(11).fill(EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS)),
          dataSource: DataSourceConfig.fromCloudWatchLogs({
            logGroupNames: ['/aws/log-group'],
            serviceNames: ['service'],
          }),
        });
      }).toThrow(/At most 10 evaluators are allowed/);
    });

    test('throws error for invalid sampling percentage - too low', () => {
      // THEN
      expect(() => {
        new OnlineEvaluation(stack, 'TestEvaluation', {
          configName: 'test_evaluation',
          evaluators: [EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS)],
          dataSource: DataSourceConfig.fromCloudWatchLogs({
            logGroupNames: ['/aws/log-group'],
            serviceNames: ['service'],
          }),
          samplingPercentage: 0.001,
        });
      }).toThrow(/at least 0.01/);
    });

    test('throws error for invalid sampling percentage - too high', () => {
      // THEN
      expect(() => {
        new OnlineEvaluation(stack, 'TestEvaluation', {
          configName: 'test_evaluation',
          evaluators: [EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS)],
          dataSource: DataSourceConfig.fromCloudWatchLogs({
            logGroupNames: ['/aws/log-group'],
            serviceNames: ['service'],
          }),
          samplingPercentage: 101,
        });
      }).toThrow(/at most 100/);
    });

    test('throws error for too many filters', () => {
      // THEN
      expect(() => {
        new OnlineEvaluation(stack, 'TestEvaluation', {
          configName: 'test_evaluation',
          evaluators: [EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS)],
          dataSource: DataSourceConfig.fromCloudWatchLogs({
            logGroupNames: ['/aws/log-group'],
            serviceNames: ['service'],
          }),
          filters: Array(6).fill({
            key: 'test',
            operator: FilterOperator.EQUALS,
            value: 'value',
          }),
        });
      }).toThrow(/At most 5 filters are allowed/);
    });

    test('throws error for invalid session timeout - too low', () => {
      // THEN
      expect(() => {
        new OnlineEvaluation(stack, 'TestEvaluation', {
          configName: 'test_evaluation',
          evaluators: [EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS)],
          dataSource: DataSourceConfig.fromCloudWatchLogs({
            logGroupNames: ['/aws/log-group'],
            serviceNames: ['service'],
          }),
          sessionTimeoutMinutes: 0,
        });
      }).toThrow(/at least 1 minute/);
    });

    test('throws error for invalid session timeout - too high', () => {
      // THEN
      expect(() => {
        new OnlineEvaluation(stack, 'TestEvaluation', {
          configName: 'test_evaluation',
          evaluators: [EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS)],
          dataSource: DataSourceConfig.fromCloudWatchLogs({
            logGroupNames: ['/aws/log-group'],
            serviceNames: ['service'],
          }),
          sessionTimeoutMinutes: 1441,
        });
      }).toThrow(/at most 1440 minutes/);
    });

    test('throws error for description too long', () => {
      // THEN
      expect(() => {
        new OnlineEvaluation(stack, 'TestEvaluation', {
          configName: 'test_evaluation',
          evaluators: [EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS)],
          dataSource: DataSourceConfig.fromCloudWatchLogs({
            logGroupNames: ['/aws/log-group'],
            serviceNames: ['service'],
          }),
          description: 'a'.repeat(201),
        });
      }).toThrow(/at most 200 characters/);
    });
  });

  describe('IAM role', () => {
    test('auto-creates execution role with required permissions', () => {
      // WHEN
      new OnlineEvaluation(stack, 'TestEvaluation', {
        configName: 'test_evaluation',
        evaluators: [EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS)],
        dataSource: DataSourceConfig.fromCloudWatchLogs({
          logGroupNames: ['/aws/bedrock-agentcore/my-agent'],
          serviceNames: ['my-agent.default'],
        }),
      });

      // THEN
      const template = Template.fromStack(stack);

      // Verify role has CloudWatch Logs read permissions
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                'logs:DescribeLogGroups',
                'logs:GetQueryResults',
                'logs:StartQuery',
              ]),
              Sid: 'CloudWatchLogReadStatement',
            }),
          ]),
        },
      });
    });

    test('uses provided execution role', () => {
      // GIVEN
      const executionRole = new iam.Role(stack, 'CustomRole', {
        assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
        roleName: 'CustomEvaluationRole',
      });

      // WHEN
      const evaluation = new OnlineEvaluation(stack, 'TestEvaluation', {
        configName: 'test_evaluation',
        evaluators: [EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS)],
        dataSource: DataSourceConfig.fromCloudWatchLogs({
          logGroupNames: ['/aws/log-group'],
          serviceNames: ['service'],
        }),
        executionRole,
      });

      // THEN
      expect(evaluation.executionRole).toBe(executionRole);
    });
  });

  describe('grant methods', () => {
    test('grantAdmin grants control plane permissions', () => {
      // GIVEN
      const evaluation = new OnlineEvaluation(stack, 'TestEvaluation', {
        configName: 'test_evaluation',
        evaluators: [EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS)],
        dataSource: DataSourceConfig.fromCloudWatchLogs({
          logGroupNames: ['/aws/log-group'],
          serviceNames: ['service'],
        }),
      });

      const grantee = new iam.Role(stack, 'Grantee', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      });

      // WHEN
      evaluation.grantAdmin(grantee);

      // THEN
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                'bedrock-agentcore:CreateOnlineEvaluationConfig',
                'bedrock-agentcore:GetOnlineEvaluationConfig',
                'bedrock-agentcore:UpdateOnlineEvaluationConfig',
                'bedrock-agentcore:DeleteOnlineEvaluationConfig',
                'bedrock-agentcore:ListOnlineEvaluationConfigs',
              ]),
            }),
          ]),
        },
      });
    });
  });

  describe('import methods', () => {
    test('fromConfigId imports by ID', () => {
      // WHEN
      const imported = OnlineEvaluation.fromConfigId(stack, 'Imported', 'my-config-id');

      // THEN
      expect(imported.configId).toBe('my-config-id');
      expect(imported.configArn).toContain('my-config-id');
    });

    test('fromConfigArn imports by ARN', () => {
      // WHEN
      const imported = OnlineEvaluation.fromConfigArn(
        stack,
        'Imported',
        'arn:aws:bedrock-agentcore:us-east-1:123456789012:online-evaluation-config/my-config-id',
      );

      // THEN
      expect(imported.configId).toBe('my-config-id');
      expect(imported.configArn).toBe(
        'arn:aws:bedrock-agentcore:us-east-1:123456789012:online-evaluation-config/my-config-id',
      );
    });

    test('fromAttributes imports with all attributes', () => {
      // WHEN
      const imported = OnlineEvaluation.fromAttributes(stack, 'Imported', {
        configArn: 'arn:aws:bedrock-agentcore:us-east-1:123456789012:online-evaluation-config/my-config-id',
        configId: 'my-config-id',
        configName: 'my_config',
        executionRoleArn: 'arn:aws:iam::123456789012:role/MyRole',
      });

      // THEN
      expect(imported.configId).toBe('my-config-id');
      expect(imported.configName).toBe('my_config');
      expect(imported.executionRole).toBeDefined();
    });
  });

  describe('metrics', () => {
    test('metric returns CloudWatch metric', () => {
      // GIVEN
      const evaluation = new OnlineEvaluation(stack, 'TestEvaluation', {
        configName: 'test_evaluation',
        evaluators: [EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS)],
        dataSource: DataSourceConfig.fromCloudWatchLogs({
          logGroupNames: ['/aws/log-group'],
          serviceNames: ['service'],
        }),
      });

      // WHEN
      const metric = evaluation.metric('TestMetric');

      // THEN
      expect(metric.namespace).toBe('AWS/Bedrock-AgentCore');
      expect(metric.metricName).toBe('TestMetric');
    });

    test('metricEvaluationCount returns evaluation count metric', () => {
      // GIVEN
      const evaluation = new OnlineEvaluation(stack, 'TestEvaluation', {
        configName: 'test_evaluation',
        evaluators: [EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS)],
        dataSource: DataSourceConfig.fromCloudWatchLogs({
          logGroupNames: ['/aws/log-group'],
          serviceNames: ['service'],
        }),
      });

      // WHEN
      const metric = evaluation.metricEvaluationCount();

      // THEN
      expect(metric.metricName).toBe('EvaluationCount');
    });

    test('metricEvaluationErrors returns errors metric', () => {
      // GIVEN
      const evaluation = new OnlineEvaluation(stack, 'TestEvaluation', {
        configName: 'test_evaluation',
        evaluators: [EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS)],
        dataSource: DataSourceConfig.fromCloudWatchLogs({
          logGroupNames: ['/aws/log-group'],
          serviceNames: ['service'],
        }),
      });

      // WHEN
      const metric = evaluation.metricEvaluationErrors();

      // THEN
      expect(metric.metricName).toBe('EvaluationErrors');
    });

    test('metricEvaluationLatency returns latency metric', () => {
      // GIVEN
      const evaluation = new OnlineEvaluation(stack, 'TestEvaluation', {
        configName: 'test_evaluation',
        evaluators: [EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS)],
        dataSource: DataSourceConfig.fromCloudWatchLogs({
          logGroupNames: ['/aws/log-group'],
          serviceNames: ['service'],
        }),
      });

      // WHEN
      const metric = evaluation.metricEvaluationLatency();

      // THEN
      expect(metric.metricName).toBe('EvaluationLatency');
    });
  });
});
