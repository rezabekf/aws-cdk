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

import { BuiltinEvaluator } from './types';

/**
 * Represents a reference to an evaluator for online evaluation.
 *
 * Use the static factory methods to create evaluator references:
 * - `EvaluatorReference.builtin()` for built-in evaluators
 * - `EvaluatorReference.custom()` for custom evaluators
 *
 * @example
 * // Using built-in evaluators
 * const helpfulness = EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS);
 * const correctness = EvaluatorReference.builtin(BuiltinEvaluator.CORRECTNESS);
 *
 * @example
 * // Using custom evaluators
 * const customEval = EvaluatorReference.custom('my-custom-evaluator-id');
 */
export class EvaluatorReference {
  /**
   * Creates a reference to a built-in evaluator.
   *
   * Built-in evaluators are provided by Amazon Bedrock AgentCore and assess
   * different aspects of agent performance at various levels (session, trace, or tool call).
   *
   * @param evaluator - The built-in evaluator to reference
   * @returns An EvaluatorReference instance
   *
   * @example
   * const helpfulness = EvaluatorReference.builtin(BuiltinEvaluator.HELPFULNESS);
   * const goalSuccess = EvaluatorReference.builtin(BuiltinEvaluator.GOAL_SUCCESS_RATE);
   */
  public static builtin(evaluator: BuiltinEvaluator): EvaluatorReference {
    return new EvaluatorReference(evaluator);
  }

  /**
   * Creates a reference to a custom evaluator.
   *
   * Custom evaluators allow you to define your own evaluation logic
   * for assessing agent performance based on your specific requirements.
   *
   * @param evaluatorId - The unique identifier of the custom evaluator
   * @returns An EvaluatorReference instance
   *
   * @example
   * const customEval = EvaluatorReference.custom('my-custom-evaluator-id');
   */
  public static custom(evaluatorId: string): EvaluatorReference {
    return new EvaluatorReference(evaluatorId);
  }

  /**
   * The evaluator identifier.
   */
  public readonly evaluatorId: string;

  private constructor(evaluatorId: string) {
    this.evaluatorId = evaluatorId;
  }

  /**
   * Renders the evaluator reference for API calls.
   * @internal
   */
  public _render(): { evaluatorId: string } {
    return {
      evaluatorId: this.evaluatorId,
    };
  }
}
