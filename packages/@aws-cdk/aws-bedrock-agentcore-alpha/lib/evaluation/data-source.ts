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

import { UnscopedValidationError } from 'aws-cdk-lib/core/lib/errors';
import { CloudWatchLogsDataSourceConfig, AgentEndpointDataSourceConfig } from './types';

/**
 * The type of data source for online evaluation.
 */
export enum DataSourceType {
  /**
   * CloudWatch Logs data source.
   */
  CLOUDWATCH_LOGS = 'CLOUDWATCH_LOGS',

  /**
   * Agent Endpoint data source.
   */
  AGENT_ENDPOINT = 'AGENT_ENDPOINT',
}

/**
 * Configuration for the data source used in online evaluation.
 *
 * Use the static factory methods to create data source configurations:
 * - `DataSourceConfig.fromCloudWatchLogs()` for CloudWatch Logs data source
 * - `DataSourceConfig.fromAgentEndpoint()` for Agent Endpoint data source
 *
 * @example
 * // CloudWatch Logs data source
 * const dataSource = DataSourceConfig.fromCloudWatchLogs({
 *   logGroupNames: ['/aws/bedrock-agentcore/my-agent'],
 *   serviceNames: ['my-agent.default'],
 * });
 *
 * @example
 * // Agent Endpoint data source
 * const dataSource = DataSourceConfig.fromAgentEndpoint({
 *   agentRuntimeId: 'my-runtime-id',
 *   endpointName: 'my-endpoint',
 * });
 */
export class DataSourceConfig {
  /**
   * Creates a CloudWatch Logs data source configuration.
   *
   * Use this when your agent traces are stored in CloudWatch Logs.
   *
   * @param config - The CloudWatch Logs data source configuration
   * @returns A DataSourceConfig instance
   *
   * @example
   * const dataSource = DataSourceConfig.fromCloudWatchLogs({
   *   logGroupNames: ['/aws/bedrock-agentcore/my-agent'],
   *   serviceNames: ['my-agent.default'],
   * });
   */
  public static fromCloudWatchLogs(config: CloudWatchLogsDataSourceConfig): DataSourceConfig {
    return new DataSourceConfig(DataSourceType.CLOUDWATCH_LOGS, {
      cloudWatchLogs: config,
    });
  }

  /**
   * Creates an Agent Endpoint data source configuration.
   *
   * Use this when you want to evaluate traces from a specific AgentCore Runtime endpoint.
   *
   * @param config - The Agent Endpoint data source configuration
   * @returns A DataSourceConfig instance
   *
   * @example
   * const dataSource = DataSourceConfig.fromAgentEndpoint({
   *   agentRuntimeId: 'my-runtime-id',
   *   endpointName: 'my-endpoint',
   * });
   */
  public static fromAgentEndpoint(config: AgentEndpointDataSourceConfig): DataSourceConfig {
    return new DataSourceConfig(DataSourceType.AGENT_ENDPOINT, {
      agentEndpoint: config,
    });
  }

  /**
   * The type of data source.
   */
  public readonly type: DataSourceType;

  /**
   * The CloudWatch Logs configuration (if applicable).
   */
  public readonly cloudWatchLogsConfig?: CloudWatchLogsDataSourceConfig;

  /**
   * The Agent Endpoint configuration (if applicable).
   */
  public readonly agentEndpointConfig?: AgentEndpointDataSourceConfig;

  private constructor(
    type: DataSourceType,
    config: {
      cloudWatchLogs?: CloudWatchLogsDataSourceConfig;
      agentEndpoint?: AgentEndpointDataSourceConfig;
    },
  ) {
    this.type = type;
    this.cloudWatchLogsConfig = config.cloudWatchLogs;
    this.agentEndpointConfig = config.agentEndpoint;
  }

  /**
   * Renders the data source configuration for API calls.
   * @internal
   */
  public _render(): any {
    if (this.type === DataSourceType.CLOUDWATCH_LOGS && this.cloudWatchLogsConfig) {
      return {
        cloudWatchLogs: {
          logGroupNames: this.cloudWatchLogsConfig.logGroupNames,
          serviceNames: this.cloudWatchLogsConfig.serviceNames,
        },
      };
    }

    if (this.type === DataSourceType.AGENT_ENDPOINT && this.agentEndpointConfig) {
      return {
        agentEndpoint: {
          agentRuntimeId: this.agentEndpointConfig.agentRuntimeId,
          endpointName: this.agentEndpointConfig.endpointName ?? 'DEFAULT',
        },
      };
    }

    throw new UnscopedValidationError(`Unknown data source type: ${this.type}`);
  }

  /**
   * Returns the log group names if this is a CloudWatch Logs data source.
   * @internal
   */
  public _getLogGroupNames(): string[] | undefined {
    return this.cloudWatchLogsConfig?.logGroupNames;
  }
}
