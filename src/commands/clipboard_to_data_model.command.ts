import * as fs from "fs";
import * as _ from "lodash";
import * as path from "path";
import * as vscode from "vscode";
import { window } from "vscode";
import { configResolver } from "../utils/configResolver";
import {
    fetchPackageInfoFor,
    getClipboardText,
    handleError,
    showPrompt,
    validateJSON,
    writeFile,
} from "../utils/utils";
import { autoExport } from "./auto_export.command";
import { ModelGenerator } from "./clipboard_to_data_model/model-generator";
import { ClassNameModel, Settings } from "./clipboard_to_data_model/settings";
import { ClassDefinition } from "./clipboard_to_data_model/syntax";

export const transformFromClipboardToDataModel = async () => {
  // let input = new Input();
  const rawEditor = vscode.window.activeTextEditor;
  if (!rawEditor) {
    vscode.window.showErrorMessage(`text editor is null`);
    return;
  }
  const packageInfo = await fetchPackageInfoFor(rawEditor.document.uri);
  if (!packageInfo) {
    vscode.window.showErrorMessage(
      "Failed to initialize extension. Is this a valid Dart/Flutter project?"
    );
    return;
  }

  var targetDirectory = `${packageInfo.projectRoot}/${configResolver.dataModelPath}`;
  if (!fs.existsSync(targetDirectory)) {
    targetDirectory = `${
      packageInfo.projectRoot
    }/lib/src/${configResolver.dataModelPath.substring(
      "lib/".length,
      configResolver.dataModelPath.length
    )}`;
  }
  const className = await showPrompt(
    "Enter the class name",
    "user_info"
  );

  if (_.isNil(className) || className!.trim() === "") {
    window.showErrorMessage("Please enter a valid name");
    return;
  }

  // if (!input.primaryConfiguration) {
  //     input = await getUserInput(true);
  // }

  // let targetDirectory: String | undefined;

  // if (_.isNil(_.get(uri, 'fsPath')) || !fs.lstatSync(uri.fsPath).isDirectory()) {
  //     targetDirectory = await promptForTargetDirectory();
  //     if (_.isNil(targetDirectory)) {
  //         window.showErrorMessage('Please select a valid directory');
  //         return;
  //     }
  // } else {
  //     targetDirectory = uri.fsPath;
  // }

  const json: string = await getClipboardText()
    .then(validateJSON)
    .catch(handleError);
  window.showInformationMessage(`${targetDirectory}, Converting: ${json}`);
  const model = new ClassNameModel(className!);
  const config: Settings = {
    model: model,
    targetDirectory: targetDirectory as string,
    json: json,
  };
  // Create new settings.
  const settings = new Settings(config);
  await createClass(settings).catch(handleError);
};

export async function createClass(settings: Settings) {
  var modelGenerator = new ModelGenerator(settings);
  var classes: ClassDefinition[] = await modelGenerator.generateDartClasses(
    settings.json
  );
  if (classes.length == 0) {
    window.showErrorMessage("Incorrect JSON format");
  }

  for await (var classDef of classes) {
    const enhancement = settings.model.enhancement;
    const fileName = `${classDef.path}${enhancement}.dart`;
    const file = path.join(`${settings.targetDirectory}`, fileName);

    if (fs.existsSync(file)) {
      window.showInformationMessage(`The file ${fileName} does exist`);
    } else {
      const data = classDef.toCodeGenString();
      await writeFile(file, data);
    }

    autoExport();
  }
}
