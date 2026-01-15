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

import { Arn, ArnFormat, Aws, Stack } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { addConstructMetadata } from 'aws-cdk-lib/core/lib/metadata-resource';
import { propertyInjectable } from 'aws-cdk-lib/core/lib/prop-injectable';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { DataSourceConfig } from './data-source';
import { EvaluatorReference } from './evaluator';
import { IOnlineEvaluationConfig, OnlineEvaluationConfigBase } from './online-evaluation-config-base';
import { EvaluationPerms } from './perms';
import {
  OnlineEvaluationConfigBaseProps,
  OnlineEvaluationConfigAttributes,
  ExecutionStatus,
} from './types';
import {
  validateConfigName,
  validateDescription,
  validateEvaluators,
  validateSamplingPercentage,
  validateFilters,
  validateSessionTimeout,
  throwIfInvalid,
} from './validation-helpers';

/******************************************************************************
 *                              PROPS
 *****************************************************************************/

/**
 * Properties for creating an OnlineEvaluationConfig.
 */
export interface OnlineEvaluationConfigProps extends OnlineEvaluationConfigBaseProps {
  /**
   * The list of evaluators to apply during online evaluation.
   *
   * Can include both built-in evaluators and custom evaluators.
   *
   * @minimum 1
   * @maximum 10
   */
  readonly evaluators: EvaluatorReference[];

  /**
   * The data source configuration that specifies where to read agent traces from.
   */
  readonly dataSource: DataSourceConfig;
}

/******************************************************************************
 *                                Class
 *****************************************************************************/

/**
 * Online evaluation configuration for Amazon Bedrock AgentCore.
 *
 * Enables continuous evaluation of agent performance using built-in or custom evaluators.
 * Supports CloudWatch Logs and Agent Endpoint data sources.
 *
 * @resource AWS::CloudFormation::CustomResource
 *
 * @example
 * // Basic usage with built-in evaluators
 * const evaluation = new OnlineEvaluationConfig(this, 'MyEvaluation', {
 *   configName: 'my_evaluation',
 *   evaluators: [
 *     EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS),
 *     EvaluatorReference.builtin(BuiltinEvaluator.CORRECTNESS),
 *   ],
 *   dataSource: DataSourceConfig.fromCloudWatchLogs({
 *     logGroupNames: ['/aws/bedrock-agentcore/my-agent'],
 *     serviceNames: ['my-agent.default'],
 *   }),
 * });
 */
@propertyInjectable
export class OnlineEvaluationConfig extends OnlineEvaluationConfigBase {
  /** Uniquely identifies this class. */
  public static readonly PROPERTY_INJECTION_ID: string =
    '@aws-cdk.aws-bedrock-agentcore-alpha.OnlineEvaluationConfig';

  /**
   * Import an existing OnlineEvaluationConfig by its ID.
   *
   * @param scope - The construct scope
   * @param id - Construct identifier
   * @param configId - The configuration ID to import
   * @returns An IOnlineEvaluationConfig reference
   */
  public static fromConfigId(
    scope: Construct,
    id: string,
    configId: string,
  ): IOnlineEvaluationConfig {
    const stack = Stack.of(scope);
    const configArn = Arn.format(
      {
        service: 'bedrock-agentcore',
        resource: 'online-evaluation-config',
        resourceName: configId,
      },
      stack,
    );

    return OnlineEvaluationConfig.fromAttributes(scope, id, {
      configArn,
      configId,
      configName: configId, // Use ID as name when importing by ID
    });
  }

  /**
   * Import an existing OnlineEvaluationConfig by its ARN.
   *
   * @param scope - The construct scope
   * @param id - Construct identifier
   * @param configArn - The configuration ARN to import
   * @returns An IOnlineEvaluationConfig reference
   */
  public static fromConfigArn(
    scope: Construct,
    id: string,
    configArn: string,
  ): IOnlineEvaluationConfig {
    const arnParts = Arn.split(configArn, ArnFormat.SLASH_RESOURCE_NAME);
    const configId = arnParts.resourceName!;

    return OnlineEvaluationConfig.fromAttributes(scope, id, {
      configArn,
      configId,
      configName: configId, // Use ID as name when importing by ARN
    });
  }

  /**
   * Import an existing OnlineEvaluationConfig from its attributes.
   *
   * @param scope - The construct scope
   * @param id - Construct identifier
   * @param attrs - The configuration attributes
   * @returns An IOnlineEvaluationConfig reference
   */
  public static fromAttributes(
    scope: Construct,
    id: string,
    attrs: OnlineEvaluationConfigAttributes,
  ): IOnlineEvaluationConfig {
    class Import extends OnlineEvaluationConfigBase {
      public readonly configArn = attrs.configArn;
      public readonly configId = attrs.configId;
      public readonly configName = attrs.configName;
      public readonly executionRole = attrs.executionRoleArn
        ? iam.Role.fromRoleArn(scope, `${id}Role`, attrs.executionRoleArn)
        : undefined;
      public readonly status = undefined;
      public readonly executionStatus = undefined;
      public readonly grantPrincipal: iam.IPrincipal;

      constructor(s: Construct, i: string) {
        super(s, i);
        this.grantPrincipal = this.executionRole ?? new iam.UnknownPrincipal({ resource: this });
      }
    }

    return new Import(scope, id);
  }

  // ------------------------------------------------------
  // Attributes
  // ------------------------------------------------------

  /**
   * The ARN of the online evaluation configuration.
   * @attribute
   */
  public readonly configArn: string;

  /**
   * The unique identifier of the online evaluation configuration.
   * @attribute
   */
  public readonly configId: string;

  /**
   * The name of the online evaluation configuration.
   * @attribute
   */
  public readonly configName: string;

  /**
   * The IAM execution role for the evaluation.
   */
  public readonly executionRole?: iam.IRole;

  /**
   * The lifecycle status of the configuration.
   * @attribute
   */
  public readonly status?: string;

  /**
   * The execution status of the evaluation.
   * @attribute
   */
  public readonly executionStatus?: string;

  /**
   * The principal to grant permissions to.
   */
  public readonly grantPrincipal: iam.IPrincipal;

  // ------------------------------------------------------
  // CONSTRUCTOR
  // ------------------------------------------------------

  constructor(scope: Construct, id: string, props: OnlineEvaluationConfigProps) {
    super(scope, id);

    // Enhanced CDK Analytics Telemetry
    addConstructMetadata(this, props);

    // ------------------------------------------------------
    // Validations
    // ------------------------------------------------------
    throwIfInvalid(validateConfigName, props.configName, this);
    throwIfInvalid(validateDescription, props.description, this);
    throwIfInvalid(validateEvaluators, props.evaluators, this);
    throwIfInvalid(validateSamplingPercentage, props.samplingPercentage, this);
    throwIfInvalid(validateFilters, props.filters, this);
    throwIfInvalid(validateSessionTimeout, props.sessionTimeoutMinutes, this);

    // ------------------------------------------------------
    // Set properties and defaults
    // ------------------------------------------------------
    this.configName = props.configName;
    this.executionRole = props.executionRole ?? this._createExecutionRole();
    this.grantPrincipal = this.executionRole;

    // ------------------------------------------------------
    // Build API parameters
    // ------------------------------------------------------
    const createParams = this._buildCreateParams(props);
    const updateParams = this._buildUpdateParams(props);

    // ------------------------------------------------------
    // AwsCustomResource for API calls
    // ------------------------------------------------------
    const customResource = new cr.AwsCustomResource(this, 'Resource', {
      resourceType: 'Custom::BedrockAgentCoreOnlineEvaluationConfig',
      installLatestAwsSdk: true, // Required for new bedrock-agentcore-control APIs
      onCreate: {
        service: 'bedrock-agentcore-control',
        action: 'CreateOnlineEvaluationConfig',
        parameters: createParams,
        physicalResourceId: cr.PhysicalResourceId.fromResponse('onlineEvaluationConfigId'),
      },
      onUpdate: {
        service: 'bedrock-agentcore-control',
        action: 'UpdateOnlineEvaluationConfig',
        parameters: updateParams,
        physicalResourceId: cr.PhysicalResourceId.fromResponse('onlineEvaluationConfigId'),
      },
      onDelete: {
        service: 'bedrock-agentcore-control',
        action: 'DeleteOnlineEvaluationConfig',
        parameters: {
          onlineEvaluationConfigId: new cr.PhysicalResourceIdReference(),
        },
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: EvaluationPerms.ADMIN_PERMS,
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          actions: ['iam:PassRole'],
          resources: [this.executionRole.roleArn],
        }),
        // The API validates CloudWatch index policy access during creation
        new iam.PolicyStatement({
          actions: [
            'logs:DescribeIndexPolicies',
            'logs:PutIndexPolicy',
            'logs:CreateLogGroup',
          ],
          resources: ['*'],
        }),
      ]),
    });

    // ------------------------------------------------------
    // Extract attributes from response
    // ------------------------------------------------------
    this.configId = customResource.getResponseField('onlineEvaluationConfigId');
    this.configArn = customResource.getResponseField('onlineEvaluationConfigArn');
  }

  // ------------------------------------------------------
  // PRIVATE METHODS
  // ------------------------------------------------------

  /**
   * Creates the execution role for the evaluation.
   */
  private _createExecutionRole(): iam.IRole {
    const stack = Stack.of(this);

    const role = new iam.Role(this, 'ExecutionRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com', {
        conditions: {
          StringEquals: {
            'aws:SourceAccount': stack.account,
            'aws:ResourceAccount': stack.account,
          },
          ArnLike: {
            'aws:SourceArn': [
              Arn.format(
                {
                  service: 'bedrock-agentcore',
                  resource: 'evaluator',
                  resourceName: '*',
                },
                stack,
              ),
              Arn.format(
                {
                  service: 'bedrock-agentcore',
                  resource: 'online-evaluation-config',
                  resourceName: '*',
                },
                stack,
              ),
            ],
          },
        },
      }),
      description: 'Execution role for Bedrock AgentCore Online Evaluation',
    });

    // Add CloudWatch Logs read permissions (required for reading agent traces)
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CloudWatchLogReadStatement',
        actions: EvaluationPerms.CLOUDWATCH_LOGS_READ_PERMS,
        resources: ['*'],
      }),
    );

    // Add CloudWatch Logs write permissions for evaluation results
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CloudWatchLogWriteStatement',
        actions: EvaluationPerms.CLOUDWATCH_LOGS_WRITE_PERMS,
        resources: [
          Arn.format(
            {
              service: 'logs',
              resource: 'log-group',
              resourceName: '/aws/bedrock-agentcore/evaluations/*',
              arnFormat: ArnFormat.COLON_RESOURCE_NAME,
            },
            stack,
          ),
        ],
      }),
    );

    // Add CloudWatch index policy permissions (for Transaction Search)
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CloudWatchIndexPolicyStatement',
        actions: EvaluationPerms.CLOUDWATCH_INDEX_POLICY_PERMS,
        resources: [
          Arn.format(
            {
              service: 'logs',
              resource: 'log-group',
              resourceName: 'aws/spans',
              arnFormat: ArnFormat.COLON_RESOURCE_NAME,
            },
            stack,
          ),
          Arn.format(
            {
              service: 'logs',
              resource: 'log-group',
              resourceName: 'aws/spans:*',
              arnFormat: ArnFormat.COLON_RESOURCE_NAME,
            },
            stack,
          ),
        ],
      }),
    );

    // Add Bedrock model invocation permissions
    role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'BedrockInvokeStatement',
        actions: EvaluationPerms.BEDROCK_MODEL_PERMS,
        resources: [
          // foundation-model with wildcard region and empty account
          `arn:${Aws.PARTITION}:bedrock:*::foundation-model/*`,
          // inference-profile with current account
          Arn.format(
            {
              service: 'bedrock',
              resource: 'inference-profile',
              resourceName: '*',
              region: '*',
            },
            stack,
          ),
        ],
      }),
    );

    return role;
  }

  /**
   * Builds the parameters for CreateOnlineEvaluationConfig API call.
   */
  private _buildCreateParams(props: OnlineEvaluationConfigProps): any {
    const params: any = {
      onlineEvaluationConfigName: props.configName,
      evaluators: props.evaluators.map((e) => e._render()),
      dataSourceConfig: props.dataSource._render(),
      evaluationExecutionRoleArn: this.executionRole!.roleArn,
      enableOnCreate: props.enableOnCreate !== false, // Default to true
    };

    if (props.description) {
      params.description = props.description;
    }

    // Build rule configuration
    params.rule = this._buildRuleConfig(props);

    return params;
  }

  /**
   * Builds the parameters for UpdateOnlineEvaluationConfig API call.
   */
  private _buildUpdateParams(props: OnlineEvaluationConfigProps): any {
    return {
      onlineEvaluationConfigId: new cr.PhysicalResourceIdReference(),
      evaluators: props.evaluators.map((e) => e._render()),
      dataSourceConfig: props.dataSource._render(),
      evaluationExecutionRoleArn: this.executionRole!.roleArn,
      description: props.description,
      rule: this._buildRuleConfig(props),
      executionStatus:
        props.enableOnCreate === false ? ExecutionStatus.DISABLED : ExecutionStatus.ENABLED,
    };
  }

  /**
   * Builds the rule configuration for the evaluation.
   */
  private _buildRuleConfig(props: OnlineEvaluationConfigProps): any {
    const rule: any = {};

    // Sampling configuration
    rule.samplingConfig = {
      samplingPercentage: props.samplingPercentage ?? 10,
    };

    // Session configuration
    rule.sessionConfig = {
      sessionTimeoutMinutes: props.sessionTimeoutMinutes ?? 15,
    };

    // Filter configuration
    if (props.filters && props.filters.length > 0) {
      rule.filters = props.filters.map((f) => ({
        key: f.key,
        operator: f.operator,
        value: this._formatFilterValue(f.value),
      }));
    }

    return rule;
  }

  /**
   * Formats a filter value for the API.
   * The API expects a union object with stringValue, doubleValue, or booleanValue.
   */
  private _formatFilterValue(value: string | number | boolean): any {
    if (typeof value === 'string') {
      return { stringValue: value };
    } else if (typeof value === 'number') {
      return { doubleValue: value };
    } else if (typeof value === 'boolean') {
      return { booleanValue: value };
    }
    return { stringValue: String(value) };
  }
}
