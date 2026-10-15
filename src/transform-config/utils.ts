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
  IConfigValueMap,
  ILocator,
  IStructVariableFieldType_WithDefaultValue,
  IVariableValue,
  IVariableType_Struct_WithDefaultValue,
  IVariableType_WithDefaultValue,
  IVariableToSet,
} from "../internal";
import { IAsyncValue } from "../types";
import { isOntologyObject } from "../types/ontologyObject";
import { VariableTypeToValueTypeToSet } from "../types/workshopContext";
import { assertNever, formatDate } from "../utils";

// Helpers for transformConfigToWorkshopContext

// Currently, object sets are limited to 10000 objects. This limit will be removed when osdk supports loading objectSets from temporary ObjectSetRids.
const MAX_OBJECTS = 10000;

/**
 * Given the value map, a value locator, and a value,
 * recursively traverses the value map and updates it.
 * 
 * @param configValueMap: the entire value map tree, given starting from the root.
 * @param valueLocator: the path to the leaf in the value map tree that needs to have its value updated.
 */
export function createNewConfigValueMapWithValueChange(
  configValueMap: IConfigValueMap,
  valueLocator: ILocator,
  value: IAsyncValue<IVariableValue | undefined>
): IConfigValueMap {
  switch (valueLocator.type) {
    case "listOf": {
      const valueMapField = configValueMap[valueLocator.configFieldId];
      if (
        valueMapField != null && 
        valueMapField.type === "listOf" &&
        valueLocator.index < valueMapField.listOfValues.length
      ) {
        const nestedConfigValueMap = valueMapField.listOfValues[valueLocator.index];
        if (nestedConfigValueMap != null) {
          return {
            ...configValueMap,
            [valueLocator.configFieldId]: {
              ...valueMapField,
              listOfValues: [
                ...valueMapField.listOfValues.slice(0, valueLocator.index),
                createNewConfigValueMapWithValueChange(
                  nestedConfigValueMap,
                  valueLocator.locator,
                  value
                ),
                ...valueMapField.listOfValues.slice(valueLocator.index + 1),
              ],
            },
          };
        }
      }
      return configValueMap;
    }
    case "single": {
      const valueMapField = configValueMap[valueLocator.configFieldId];
      if (valueMapField != null && valueMapField.type === "single") {
        return {
          ...configValueMap,
          [valueLocator.configFieldId]: {
            ...valueMapField,
            value: value,
          },
        };
      }
      return configValueMap;
    }
    default:
      assertNever(
        `Unknown ILocator type ${valueLocator} when creating context`,
        valueLocator
      );
  }
}

/**
 * Given an unkonwn value, returns true only if it is a valid Date object.
 */
function isDate(val: unknown): val is Date {
  return val instanceof Date && !isNaN(val.getTime());
}

/**
 * Before setting a value in the context's value map:
 * - for objectSet variables, extract the primaryKeys, which is OSDK's preferred format to load objects with and cap to first 10,000 primaryKeys
 * - for date variables, convert from Date value to string value in format "yyyy-mm-dd"
 * - for date array variables, convert from Date[] value to string[] in format "yyyy-mm-dd" per entry
 * - for struct variables, transform each struct field's value based on its struct field type
 */
export function maybeTransformValueToSetToValueMapTypes<
  V extends IVariableType_WithDefaultValue
>(
  variableType: IVariableType_WithDefaultValue,
  value?: VariableTypeToValueTypeToSet<V>
): IVariableValue | undefined {
  if (value != null && typeof value === "object" && "structFields" in value) {
    return variableType.type === "struct"
      ? transformStructFieldValues(
          variableType,
          value,
          maybeTransformValueToSetToValueMapTypes
        )
      : undefined;
  }
  // Empty primitive arrays 
  if (Array.isArray(value) && value.length === 0 && variableType.type !== "objectSet") {
    return [];
  }
  // OntologyObject arrays
  if (Array.isArray(value) && value.every(isOntologyObject)) {
    if (
      value.every(
        (ontologyObject) => typeof ontologyObject.$primaryKey === "string"
      )
    ) {
      return {
        type: "string",
        primaryKeys: value
          .slice(0, MAX_OBJECTS)
          .map((ontologyObject) => ontologyObject.$primaryKey) as string[],
      };
    } else if (
      value.every(
        (ontologyObject) => typeof ontologyObject.$primaryKey === "number"
      )
    ) {
      return {
        type: "number",
        primaryKeys: value
          .slice(0, MAX_OBJECTS)
          .map((ontologyObject) => ontologyObject.$primaryKey) as number[],
      };
    }
    return undefined;
  } else if (variableType.type === "date" && isDate(value)) {
    return formatDate(value);
  } else if (
    variableType.type === "date-list" &&
    Array.isArray(value) &&
    value.every(isDate)
  ) {
    return value.map(formatDate);
  }
  return value;
}

/**
 * Before sending a value to Workshop:
 * - for objectSet variables, extract the objectRids, which is Workshop's preferred format to load objects with and cap to first 10,000 objectRids
 * - for date variables, convert from Date value to string value in format "yyyy-mm-dd"
 * - for date array variables, convert from Date[] value to string[] in format "yyyy-mm-dd" per entry
 * - for struct variables, transform each struct field's value based on its struct field type
 */
export function maybeTransformValueToSetToWorkshopValue<
  V extends IVariableType_WithDefaultValue
>(
  variableType: IVariableType_WithDefaultValue,
  value?: VariableTypeToValueTypeToSet<V>
): IVariableToSet | undefined {
  if (value != null && typeof value === "object" && "structFields" in value) {
    return variableType.type === "struct"
      ? transformStructFieldValues(
          variableType,
          value,
          (structFieldType, structFieldValue) =>
            maybeTransformValueToSetToWorkshopValue(
              getWorkshopStructFieldType(structFieldType),
              structFieldValue
            )
        )
      : undefined;
  }
  // Empty primitve arrays 
  if (Array.isArray(value) && value.length === 0 && variableType.type !== "objectSet") {
    return [];
  }
  // OntologyObject arrays
  if (Array.isArray(value) && value.every(isOntologyObject)) {
    return {
      objectRids: value
        .slice(0, MAX_OBJECTS)
        .map((ontologyObject) => ontologyObject.$rid),
    };
  } else if (variableType.type === "date" && isDate(value)) {
    return formatDate(value);
  } else if (
    variableType.type === "date-list" &&
    Array.isArray(value) &&
    value.every(isDate)
  ) {
    return value.map(formatDate);
  }
  return value;
}

/**
 * Transforms the value of each struct field defined on the struct variable type.
 * Struct fields not defined on the struct variable type are dropped.
 */
function transformStructFieldValues<TransformedValue>(
  structVariableType: IVariableType_Struct_WithDefaultValue,
  structValue: VariableTypeToValueTypeToSet<IVariableType_Struct_WithDefaultValue>,
  transformStructFieldValue: (
    structFieldType: IStructVariableFieldType_WithDefaultValue,
    structFieldValue:
      | VariableTypeToValueTypeToSet<IStructVariableFieldType_WithDefaultValue>
      | undefined
  ) => TransformedValue | undefined
): { structFields: { [structFieldId: string]: TransformedValue | undefined } } {
  return {
    structFields: Object.fromEntries(
      structVariableType.structFieldTypes.map(({ fieldId, fieldType }) => [
        fieldId,
        transformStructFieldValue(fieldType, structValue.structFields[fieldId]),
      ])
    ),
  };
}

/**
 * NOTE: Workshop only converts "yyyy-mm-dd" strings back into Dates based on the top level variable type, which for struct fields
 * is the struct rather than the struct field. Treating date struct fields as timestamps sends them to Workshop as Date objects instead.
 */
function getWorkshopStructFieldType(
  structFieldType: IStructVariableFieldType_WithDefaultValue
): IStructVariableFieldType_WithDefaultValue {
  switch (structFieldType.type) {
    case "date":
      return { type: "timestamp" };
    case "date-list":
      return { type: "timestamp-list" };
    default:
      return structFieldType;
  }
}
