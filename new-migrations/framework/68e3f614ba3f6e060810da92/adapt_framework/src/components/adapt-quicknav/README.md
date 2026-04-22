adapt-quicknav
================

<img src="demo.gif" alt="the quicknav extension in action" align="right">

Navigation bar component which can contain some or all of the following buttons:
- _returnToPreviousLocation (takes you back to the previous location - not back in history, just the last routed location)
- _home (takes you back to top level menu)
- _up (takes you to the menu the next level up in the hierarchy)
- _previous (navigates directly to the previous page, if exists, without having to navigate via the menu)
- _next (navigates directly to the next page, if exists, without having to navigate via the menu)
- _sibling (1,2,3,4 etc buttons representing each sibling page)
- _close (closes the course window - only possible if the course was launched in a popup window)

The quicknav buttons will respect any [locking](https://github.com/adaptlearning/adapt_framework/wiki/Locking-objects-with-'_isLocked'-and-'_lockType'#using-locking-with-menus) that has been configured in Adapt. In cases not covered by Adapt's locking system - such as a [start page](https://github.com/adaptlearning/adapt_framework/wiki/Content-starts-with-course.json#example-1) that appears immediately before the main menu - the setting `_lockUntilPageComplete` can be used to disable the button until the current page has been completed.