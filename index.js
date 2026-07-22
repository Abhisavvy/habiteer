import { registerWidgetTaskHandler } from "react-native-android-widget";
import { widgetTaskHandler } from "./src/features/widget/taskHandler";

registerWidgetTaskHandler(widgetTaskHandler);

// require(), not import — import statements are hoisted above this file's
// own top-level code, which would run expo-router's entry before the
// registerWidgetTaskHandler call above. require() runs in textual order.
require("expo-router/entry");
