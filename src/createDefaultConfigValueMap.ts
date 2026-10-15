/**
 * Copyright 2024 Palantir Technologies, Inc.
 *
 * Licensed under Palantir's License;
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at LICENSE.md
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


import { asyncValueLoaded, IAsyncValue, IConfigDefinition } from "./types";
import { assertNever, formatDate } from "./utils";
import {
  IConfigValueMap,
  IVariableType_Struct_WithDefaultValue,
  IVariableType_WithDefaultValue,
  IVariableValue,
  StructValue,
} from "./internal";

/**
 * Takes the configDefinition and pulls out the default values, creating a default config values map.
 */
export function createDefaultConfigValueMap(
  configFields: IConfigDefinition
): IConfigValueMap {
  const configValueMap: IConfigValueMap = {};

  configFields.forEach((configField) => {
    switch (configField.field.type) {
      case "single":
        switch (configField.field.fieldValue.type) {
          case "inputOutput":
            configValueMap[configField.fieldId] = {
              type: "single",
              value: variableTypeWithDefaultValueToValue(
                configField.field.fieldValue.variableType
              ),
            };
            return;
          case "event":
            return;
          default:
            assertNever(
              `Unkonwn IConfigDefinitionFieldType type ${configField.field.fieldValue} when creating default config values map`,
              configField.field.fieldValue
            );
        }
        break;
      case "listOf":
        configValueMap[configField.fieldId] = {
          type: "listOf",
          listOfValues: [],
        };
        return;
      default:
        assertNever(
          `Unknown IConfigurationFieldType type ${configField.field} when creating default config values map`,
          configField.field
        );
    }
  });

  return configValueMap;
}

function variableTypeWithDefaultValueToValue(
  variableType: IVariableType_WithDefaultValue
): IAsyncValue<IVariableValue | undefined> {
  return asyncValueLoaded(getDefaultValue(variableType));
}

function getDefaultValue(
  variableType: IVariableType_WithDefaultValue
): IVariableValue | undefined {
  switch (variableType.type) {
    // For date and date-list variable types, need to convert from Date to string and Date[] to string[]
    // As we will save date values as strings in format "yyyy-mm-dd"
    case "date":
      return variableType.defaultValue == null
        ? undefined
        : formatDate(variableType.defaultValue);
    case "date-list":
      return variableType.defaultValue?.map(formatDate);
    case "struct":
      return getStructDefaultValue(variableType);
    default:
      return variableType.defaultValue;
  }
}

/**
 * A struct only has a default value if at least one of its struct fields has a default value.
 */
function getStructDefaultValue(
  structVariableType: IVariableType_Struct_WithDefaultValue
): StructValue | undefined {
  const structFieldEntries = structVariableType.structFieldTypes.map(
    ({ fieldId, fieldType }) => [fieldId, getDefaultValue(fieldType)] as const
  );
  if (structFieldEntries.every(([, defaultValue]) => defaultValue == null)) {
    return undefined;
  }
  return { structFields: Object.fromEntries(structFieldEntries) };
}
