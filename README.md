# Workshop Iframe Custom Widget

## Description

A plugin to be used in custom applications to enable bi-directional communication between the iframed react app and [Palantir's Workshop](https://www.palantir.com/docs/foundry/workshop/overview/) parent. The two way communication includes the following:

- Workshop can pass variable values to the iframed app
- The iframed app is able to set variables' values in Workshop
- The iframed app is able to execute events configured in Workshop

## How does it work?

![Diagram of how this package works](./src/media/workshop-iframe-custom-widget-diagram.png)

## When should I use this?

So why might you use this new option OSDK + custom iframe widget and why are we so excited about it? If you are a customer builder, this is the first time Palantir Workshop supports creating a new custom Workshop widget from a custom application. This is the recommended path for custom widgets and we’re hoping it unlocks what can be created in Workshop!

## Limitations

- When a user opens the iframe for the first time they might see a login screen to authenticate. The iframe is responsible for going through the necessary authentication flow.
- ObjectSet variables require specifying a concrete ObjectType for a given variable. Additionally, the current limit is 10,000 objects primaryKeys/objectRids that can be passed back and forth between Workshop and the iframed app. Any more and they will be cut off at the first 10,000. This limitation will be removed once OSDK is able to support loading ObjectSets from temporary objectSetRids.
- Struct variable are not currently supported, but they are coming soon.

## Install

We plan to publish this as an npm package so that you will be able to install it using a command similar to: 

```
npm install @osdk/workshop-iframe-custom-widget
```
Until then, you can download the [tarball file](./workshop-iframe-custom-widget-1.0.0.tgz) in this repo, drop it into your web application's files and install it using command 
```
npm install PATH_TO/workshop-iframe-custom-widget-1.0.0.tgz
```

## Use

See [Examples.tsx](./src/example/Example.tsx) for a complete example, and see [ExampleConfig.ts](./src/example/ExampleConfig.ts) for a comprehensive example using all config field types.

A basic config definition:

```typescript
export const BASIC_CONFIG_DEFINITION = [
  {
    fieldId: "stringField",
    field: {
      type: "single",
      fieldValue: {
        type: "inputOutput",
        variableType: {
          type: "string",
          defaultValue: "test",
        },
      },
      label: "Input string (title)",
    },
  },
  {
    fieldId: "workshopEvent",
    field: {
      type: "single",
      label: "Events",
      fieldValue: {
        type: "event",
      },
    },
  },
  {
    fieldId: "listOfField",
    field: {
      type: "listOf",
      label: "A list of fields",
      addButtonText: "Add another item to these listOf fields",
      config: [
        {
          fieldId: "booleanListField",
          field: {
            type: "single",
            label: "Boolean list in a listOf",
            fieldValue: {
              type: "inputOutput",
              variableType: {
                type: "boolean-list",
                defaultValue: [true, false, true, false],
              },
            },
          },
        },
      ],
    },
  },
  ...
] as const satisfies IConfigDefinition;
```

It is imperative to declare the config as a const. In order to transform the config into a context object where each `fieldId` becomes a property in the context object, the input config to `useWorkshopContext` must be declared as an object literal using `as const`.

Here is an example React component that shows how to call `useWorkshopContext` with the config above:

```typescript
const ExampleComponent = () => {
  const workshopContext = useWorkshopContext(BASIC_CONFIG_DEFINITION);

  if (isAsyncValue_Loading(workshopContext)) {
    // Render a loading state
  } else if (isAsyncValue_Loaded(workshopContext)) {
    // Must explicitly declare type for the loaded context value
    const loadedWorkshopContext: IWorkshopContext<typeof BASIC_CONFIG_DEFINITION> = workshopContext.value;

    const { stringField, workshopEvent, listOfField } = loadedWorkshopContext;

    // Examples of retrieving single field values.
    const stringValue: IAsyncValue<string | undefined> = stringField.fieldValue;

    // Examples of retrieving listOf field values.
    listOfField.forEach(listItem => {
        const booleanListValue: IAsyncValue<boolean[] | undefined> = listItem.booleanListField.fieldValue;
    });

    // Examples of setting single field values.
    stringField.setLoading();
    stringField.setLoadedValue("Hello world!");
    stringField.setReloadingValue("Hello world is reloading.");
    stringField.setFailedWithError("Hello world failed to load.");

    // Examples of setting listOf field values.
    listOfField.forEach((listItem, index) => {
        listItem.booleanListField.setLoading();
        listItem.booleanListField.setLoadedValue([true, false]);
        listItem.booleanListField.setReloadingValue([false, true]);
        listItem.booleanListField.setFailedWithError(`Failed to load on listOf layer ${index}`);
    });


    // Example of executing event. Takes a React MouseEvent, or undefined if not applicable
    workshopEvent.executeEvent(undefined);


    return <div>Render something here.</div>;
  } else if (isAsyncValue_FailedLoading(workshopContext)) {
    // Render a failure state
  }
};
```

## FAQ's

1. Why is the context object returned by `useWorkshopContext` wrapped in an async loading state?

   Please refer to the diagram Figure 1.a and 1.b. When your custom app is iframed inside of Workshop, the context object will not exist until Workshop accepts the config parameter and as such will be in a loading state until it is accepted. It may also be rejected by Workshop and as such will be wrapped in a failed to load async state with an accompanying error message.

2. Why should I provide default values when defining the config passed to `useWorkshopContext`?

   During development when your custom app is not iframed in Workshop, its not receiving any values and as such it would make development difficult if all you had to work with were a forever loading context object or a loaded context object with null values. Allowing you to provide default values when defining the config that gets translated to the context object returned by `useWorkshopContext` helps you during development when the app is not being iframed, as the plugin will detect whether your app is being iframed and if not, will return a loaded context object populated with your default values.

3. Why is each value inside the context object returned by `useWorkshopContext` wrapped in with an async loading state?

   Workshop's variables each have an async loading state, as variables could come from asynchronous execution, such as a function that takes 10 seconds to return a value. Having a 1:1 match between the types in the context object and Workshop means that the two have a consistent view of variable values. If a variable in Workshop goes into a loading state or fails to load, this async state is passed to the iframed app allowing you to decide how to handle cases where one of the parameters is not available or currently might be re-loading. For example when implementing a custom submission form, you might want to disable the submission button if some of the inputs to your form hasn't loaded yet or are currently re-loading.
   
## Questions/Support

  Please post to [https://community.palantir.com/](https://community.palantir.com/)
  
## License 

The source code, documentation, and other materials herein are subject to the Palantir License. See [LICENSE](./LICENSE).
