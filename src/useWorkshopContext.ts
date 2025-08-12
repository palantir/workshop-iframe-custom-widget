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
import React from "react";
import {
  IAsyncValue,
  asyncValueLoading,
  asyncValueLoaded,
  asyncValueFailed,
} from "./types/loadingState";
import { isInsideIframe, sendMessageToWorkshop } from "./utils";
import { IWorkshopContext } from "./types/workshopContext";
import { createDefaultConfigValueMap } from "./createDefaultConfigValueMap";
import { transformConfigWorkshopContext } from "./transform-config";
import {
  IConfigValueMap,
  MESSAGE_TYPES_TO_WORKSHOP,
  MESSAGE_TYPES_FROM_WORKSHOP,
  IMessageFromWorkshop,
} from "./internal";
import { IConfigDefinition } from "./types";

/**
 * Given the definition of config fields, returns a context object in an async wrapper with properties of the requested fields' IDs,
 * and depending on the field type, each property contains either a value in an async wrapper with setter methods or a method to execute a Workshop event.
 *
 * @param configFields: IConfigDefinition
 * @returns IAsyncValue<IWorkshopContext>, a context object in an async wrapper.
 */
/**
 * Extends the IWorkshopContext with a setHeight function
 */
export type IWorkshopContextWithHeight<T extends IConfigDefinition> = IWorkshopContext<T> & {
  /**
   * Sets the maximum height of the iframe in Workshop.
   * Only has an effect when the app is running inside an iframe AND
   * the Workshop widget's height is set to "auto (max)".
   * @param height The maximum height in pixels
   */
  setAutoMaxHeight: (height: number) => void;
}

export function useWorkshopContext<T extends IConfigDefinition>(
  configFields: IConfigDefinition
): IAsyncValue<IWorkshopContextWithHeight<T>> {
  // The context's definition
  const [configDefinition] = React.useState<IConfigDefinition>(configFields);
  // The context's values
  const [configValues, setConfigValues] = React.useState<IConfigValueMap>(
    createDefaultConfigValueMap(configFields)
  );

  // The id of the corresponding widget
  const [iframeWidgetId, setIframeWidgetId] = React.useState<string>();

  // Boolean checks
  const [workshopRejectionReason, setWorkshopRejectionReason] =
    React.useState<string>();
  const [workshopReceivedConfig, setWorkshopReceivedConfig] =
    React.useState<boolean>(false);

  /**
   * Handles each type of message received from Workshop.
   */
  const messageHandler = React.useCallback(
    (event: MessageEvent<IMessageFromWorkshop>) => {
      // only process messages from the parent window (otherwise messages posted by 3rd party widgets may be processed)
      if (event.source !== window.parent || window.parent === window) {
        return;
      }
      const message = event.data;
      switch (message.type) {
        case MESSAGE_TYPES_FROM_WORKSHOP.CONFIG_ACCEPTED:
          setIframeWidgetId(message.iframeWidgetId);
          setWorkshopReceivedConfig(true);
          setConfigValues(message.configValues);
          return;
        case MESSAGE_TYPES_FROM_WORKSHOP.CONFIG_REJECTED:
          setIframeWidgetId(message.iframeWidgetId);
          setWorkshopRejectionReason(message.rejectionReason);
          return;
        case MESSAGE_TYPES_FROM_WORKSHOP.REQUESTING_CONFIG:
          setIframeWidgetId(message.iframeWidgetId);
          sendMessageToWorkshop({
            type: MESSAGE_TYPES_TO_WORKSHOP.SENDING_CONFIG,
            config: configFields,
            pathname: window.location.pathname,
          });
          return;
        case MESSAGE_TYPES_FROM_WORKSHOP.VALUE_CHANGE:
          if (message.iframeWidgetId === iframeWidgetId) {
            setConfigValues(message.configValues);
          }
          return;
      }
    },
    [configFields, iframeWidgetId]
  );

  // Once on mount
  React.useEffect(() => {
    sendMessageToWorkshop({
      type: MESSAGE_TYPES_TO_WORKSHOP.SENDING_CONFIG,
      config: configFields,
      pathname: window.location.pathname,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    window.addEventListener("message", messageHandler);

    return () => {
      window.removeEventListener("message", messageHandler);
    };
  }, [messageHandler]);

  const insideIframe = isInsideIframe();

  // Create a function to set the auto max height of the iframe (only works when Workshop widget height is set to "auto (max)")
  const setAutoMaxHeight = React.useCallback((height: number) => {
    if (isInsideIframe() && iframeWidgetId != null) {
      sendMessageToWorkshop({
        type: MESSAGE_TYPES_TO_WORKSHOP.SET_AUTO_MAX_HEIGHT,
        iframeWidgetId,
        height,
      });
    }
  }, [iframeWidgetId]);

  // Create the context with the setAutoMaxHeight function
  const createContextWithHeight = React.useCallback(
    (context: IWorkshopContext<T>): IWorkshopContextWithHeight<T> => {
      return {
        ...context,
        setAutoMaxHeight,
      };
    },
    [setAutoMaxHeight]
  );

  // If not inside iframe, simply return the loaded context with default values
  if (!insideIframe) {
    return asyncValueLoaded(
      createContextWithHeight(
        transformConfigWorkshopContext(
          configDefinition,
          configValues,
          setConfigValues,
          iframeWidgetId
        )
      )
    );
  }

  // Config was rejected by workshop, return failed along with reason
  if (workshopRejectionReason != null) {
    return asyncValueFailed(
      `Workshop rejected the config definition due to the following reason: ${workshopRejectionReason}`
    );
  }

  // Finally, if inside iframe and Workshop has signalled that the config was received,
  // return the loaded context otherwise return that the context is loading.
  return workshopReceivedConfig
    ? asyncValueLoaded(
        createContextWithHeight(
          transformConfigWorkshopContext(
            configDefinition,
            configValues,
            setConfigValues,
            iframeWidgetId
          )
        )
      )
    : asyncValueLoading();
}
