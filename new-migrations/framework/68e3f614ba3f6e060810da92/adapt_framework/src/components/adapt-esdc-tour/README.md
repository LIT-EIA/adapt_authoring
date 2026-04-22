# adapt-esdc-tour

**Guided Tour** is a *presentation component* for Adapt.

![gif animation displaying guided tour](https://raw.githubusercontent.com/wiki/LIT-EIA/adapt-esdc-tour/adapt-esdc-tour-animated-demo.gif)

The Adapt Guided Tour Component is a versatile solution for guiding users through a series of steps or features on a form, system, application, or website. Similar to hotgraphic, it's a useful tool for onboarding new users, providing feature tutorials, and giving guided tours of a system's functionality. This plugin allows developers to create interactive step-by-step guides that highlight specific elements on an image based on their position and include instructions or information for each step. It's particularly useful for improving user engagement and reducing confusion for new users navigating a complex interface. The component is powered by [ShepherdJS](https://github.com/shepherd-pro/shepherd), ensuring a smooth and interactive user experience.

## Features

- **Interactive Step-by-Step Guides**: Create engaging guided tours that lead users through essential features or processes, enhancing comprehension and user experience.
- **Dynamic Highlighting**: Highlight specific elements on an image to draw users' attention and provide contextually relevant instructions or information.
- **Versatility**: Suitable for various applications, including onboarding new users, providing feature tutorials, or guiding users through complex interfaces.
- **Reduced User Confusion**: Improve user engagement and reduce confusion for new users navigating a complex interface with clear, step-by-step instructions.
- **Enhanced User Engagement**: Increase user engagement by offering interactive guided tours that facilitate learning and exploration of system functionality.

## Installation

To install the Adapt Guided Tour Component in the Adapt framework, run the following command from the command line:

```sh
adapt install adapt-esdc-tour
```

To install the plugin to the Authoring Tool, follow these steps:

1. **Download the Plugin**: Obtain the plugin from the GitHub repository or another source.
2. **Upload to Authoring Tool**: Use the Adapt authoring tool\'s Plug-in Manager to upload and install the plugin.

## Settings Overview

Below are the attributes used in `components.json` to configure the Adapt Tour Component. These attributes are properly formatted as JSON in `example.json`.

### Global Settings

- **ariaRegion (string)**: The default ARIA label for the tour. It provides context for screen reader users.
- **closeText (string)**: The text displayed on the button to close the tour.
- **nextText (string)**: The text displayed on the button to go to the next step.
- **previousText (string)**: The text displayed on the button to go to the previous step.
- **startTourText (string)**: The text displayed on the button to start the tour.
- **stepPagination (string)**: Label for each item, indicating the current step number and total steps.
- **stepPaginationAria (string)**: ARIA label for each item, providing the step number and total steps for screen reader users.

### Properties

- **_supportedLayout (string)**: Defines the supported layout for the component.
- **instruction (string)**: Optional text that appears above the component, often used to guide the learner’s interaction with the component.
- **_setCompletionOn (string)**: Determines when Adapt will register this component as complete.
- **mobileBody (string)**: Body text displayed on mobile devices when the component behaves like a Narrative component.
- **mobileInstruction (string)**: Instruction text displayed on mobile devices when the component behaves like a Narrative component.
- **_hidePagination (boolean)**: If enabled, hides the pagination in the bubbles.

### _items (array)

Each entry in the array represents a step in the guided tour and should contain the following properties:

- **title (string)**: Title displayed in the step bubble.
- **body (string)**: Main text displayed in the step bubble.
- **_graphic (object)**: Path to the background image displayed behind the step.
  - src: Source of the image to be displayed
  - alt: Slternative text for the image displayed behind the step.
  - _forceFullWidth: Forces image to take full width of component.
- **_pinfinder (string)**: Only used with special Authoring Tool plugin.
- **_pin (object)**: Properties for the pin, including position and direction.
  - _left: Left position of the pin.
  - _top: Top position of the pin.
  - _bubbledirection: Direction of the bubble.
  - _bordercolor: Bubble border color.
----------------------------
Requires framework >=4.4.1
