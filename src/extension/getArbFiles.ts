import * as vscode from 'vscode';
import * as yaml from 'yaml';
import { resolvePath } from '../utils/utils';

async function findYamlFiles(projectName: string, yamlFileName: string): Promise<vscode.Uri[]> {
  const yamlFiles = await vscode.workspace.findFiles(`**/${projectName}/${yamlFileName}`);
  if (yamlFiles.length !== 0) {
    return yamlFiles;
  }
  return await vscode.workspace.findFiles(`**/${yamlFileName}`);
}

async function findFiles(include: string): Promise<vscode.Uri[]> {
  return await vscode.workspace.findFiles(resolvePath(include));
}

async function findArbFiles(projectName: string, arbDir: string): Promise<vscode.Uri[]> {
  const arbFiles = await findFiles(`**/${projectName}/${arbDir}/*.arb`);
  if (arbFiles.length !== 0) {
    return arbFiles;
  }
  return await findFiles(`**/${arbDir}/*.arb`);
}

export async function getArbFiles(projectName: string): Promise<[vscode.Uri[], vscode.Uri | undefined]> {
  const yamlFileName = 'l10n.yaml';
  const yamlFiles = (await findYamlFiles(projectName, yamlFileName)).filter((yamlFile) => yamlFile.path.includes('.fvm') === false);

  if (yamlFiles.length === 0) {
    const errorMessage = `The ${yamlFileName} file was not found.`;
    vscode.window.showErrorMessage(errorMessage);
    throw new Error(errorMessage);
  }
  const yamlFile = yamlFiles[0];
  const textDocument = await vscode.workspace.openTextDocument(yamlFile);
  const parsedConfiguration = yaml.parseDocument(textDocument.getText());

  const arbDir = parsedConfiguration.get('arb-dir') as string;
  const arbFiles = await findArbFiles(projectName, arbDir);

  const templateArbFileName = (parsedConfiguration.get('template-arb-file') as string | undefined) ?? 'app_en.arb';
  const templateArbFile = arbFiles.find((arbFile) => arbFile.path.endsWith(templateArbFileName));
  return [arbFiles, templateArbFile];
}
