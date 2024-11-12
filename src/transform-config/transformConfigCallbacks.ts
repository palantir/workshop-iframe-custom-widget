/**
Copyright 2024 Palantir Technologies, Inc.

Licensed under Palantir's License;
you may not use this file except in compliance with the License.
You may obtain a copy of the License from the root of this repository at LICENSE.md

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
 */
import {
  IVariableType_WithDefaultValue,
  ILocator,
  MESSAGE_TYPES_TO_WORKSHOP,
  IConfigValueMap,
} from "../internal";
import {
  asyncValueLoaded,
  asyncReloading,
  asyncValueLoading,
  asyncValueFailed,
} from "../types";
import { VariableTypeToValueTypeToSet } from "../types/workshopContext";
import { sendMessageToWorkshop } from "../utils";
import {
  maybeTransformValueToSetToValueMapTypes,
  createNewConfigValueMapWithValueChange,
  maybeTransformValueToSetToWorkshopValue,
} from "./utils";

/**
 * @returns a function to set a context field as "loaded" with a value
 */
export const createSetLoadedValueCallback =
  <V extends IVariableType_WithDefaultValue>(
    iframeWidgetId: string | undefined,
    setConfigValues: (newConfigValues: IConfigValueMap) => void,
    configValues: IConfigValueMap,
    valueLocator: ILocator,
    variableType: IVariableType_WithDefaultValue
  ) =>
  (value?: VariableTypeToValueTypeToSet<V>) => {
    const variableValue = maybeTransformValueToSetToValueMapTypes(
      variableType,
      value
    );
    setConfigValues(
      createNewConfigValueMapWithValueChange(
        configValues,
        valueLocator,
        asyncValueLoaded(variableValue)
      )
    );

    const valueTypeToSet = maybeTransformValueToSetToWorkshopValue(
      variableType,
      value
    );

    // Only able to send message to workshop if iframeWidgetId was received
    if (iframeWidgetId != null) {
      sendMessageToWorkshop({
        type: MESSAGE_TYPES_TO_WORKSHOP.SETTING_VALUE,
        iframeWidgetId: iframeWidgetId,
        valueLocator,
        // Workshop has null values outside async wrapper 
        value:
          valueTypeToSet == null
            ? valueTypeToSet
            : asyncValueLoaded(valueTypeToSet),
      });
    }
  };

/**
 * @returns a function to set a context field as "reloading" with a value
 */
export const createSetReloadingValueCallback =
  <V extends IVariableType_WithDefaultValue>(
    iframeWidgetId: string | undefined,
    setConfigValues: (newConfigValues: IConfigValueMap) => void,
    configValues: IConfigValueMap,
    valueLocator: ILocator,
    variableType: IVariableType_WithDefaultValue
  ) =>
  (value?: VariableTypeToValueTypeToSet<V>) => {
    const variableValue = maybeTransformValueToSetToValueMapTypes(
      variableType,
      value
    );
    setConfigValues(
      createNewConfigValueMapWithValueChange(
        configValues,
        valueLocator,
        asyncReloading(variableValue)
      )
    );

    const valueTypeToSet = maybeTransformValueToSetToWorkshopValue(
      variableType,
      value
    );

    // Only able to send message to workshop if iframeWidgetId was received
    if (iframeWidgetId != null) {
      sendMessageToWorkshop({
        type: MESSAGE_TYPES_TO_WORKSHOP.SETTING_VALUE,
        iframeWidgetId,
        valueLocator,
        // Workshop has null values outside async wrapper 
        value:
          valueTypeToSet == null
            ? valueTypeToSet
            : asyncReloading(valueTypeToSet),
      });
    }
  };

/**
 * @returns a function to set a context field as "loading"
 */
export const createSetLoadingCallback =
  (iframeWidgetId: string | undefined, valueLocator: ILocator) => () => {
    // Only able to send message to workshop if iframeWidgetId was received
    if (iframeWidgetId != null) {
      sendMessageToWorkshop({
        type: MESSAGE_TYPES_TO_WORKSHOP.SETTING_VALUE,
        iframeWidgetId,
        valueLocator,
        value: asyncValueLoading(),
      });
    }
  };

/**
 * @returns a function to set a context field as "failed" with an error message
 */
export const createSetFailedWithErrorCallback =
  (iframeWidgetId: string | undefined, valueLocator: ILocator) =>
  (error: string) => {
    // Only able to send message to workshop if iframeWidgetId was received
    if (iframeWidgetId != null) {
      sendMessageToWorkshop({
        type: MESSAGE_TYPES_TO_WORKSHOP.SETTING_VALUE,
        iframeWidgetId,
        valueLocator,
        value: asyncValueFailed(error),
      });
    }
  };

  /**
 * @returns a function to execute an event in Workshop
 */
export const createExecuteEventCallback =
  (iframeWidgetId: string | undefined, eventLocator: ILocator) =>
  (mouseEvent?: MouseEvent) => {
    // Only able to send message to workshop if iframeWidgetId was received
    if (iframeWidgetId != null) {
      sendMessageToWorkshop({
        type: MESSAGE_TYPES_TO_WORKSHOP.EXECUTING_EVENT,
        iframeWidgetId,
        eventLocator,
        mouseEvent,
      });
    }
  };
