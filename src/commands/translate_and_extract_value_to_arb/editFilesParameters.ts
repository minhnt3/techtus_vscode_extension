import * as vscode from 'vscode';
import { KeyValuePair } from '../../extension/keyValuePair';
import { Placeholder } from '../../utils/utils';

export class EditFilesParameters {
  constructor(
    readonly uri: vscode.Uri,
    readonly range: vscode.Range,
    readonly keyValue: KeyValuePair,
    readonly description: string | null,
    readonly placeholders: Placeholder[],
  ) {}
}
