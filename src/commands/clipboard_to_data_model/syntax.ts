import * as _ from "lodash";
import * as changeCase from "change-case";
import { ClassNameModel } from "./settings";
import { TypeDefinition } from "./constructor";
export const emptyListWarn = "list is empty";
export const ambiguousListWarn = "list is ambiguous";
export const ambiguousTypeWarn = "type is ambiguous";
export class Warning {
  warning: string;
  path: string;

  constructor(warning: string, path: string) {
    this.warning = warning;
    this.path = path;
  }
}

export function newEmptyListWarn(path: string): Warning {
  return new Warning(emptyListWarn, path);
}

export function newAmbiguousListWarn(path: string): Warning {
  return new Warning(ambiguousListWarn, path);
}

export function newAmbiguousType(path: string): Warning {
  return new Warning(ambiguousTypeWarn, path);
}

export class WithWarning<T> {
  result: T;
  warnings: Warning[];

  constructor(result: T, warnings: Warning[]) {
    this.result = result;
    this.warnings = warnings;
  }
}

export const printLine = (print: string, lines = 0, tabs = 0): string => {
  var sb = "";

  for (let i = 0; i < lines; i++) {
    sb += "\n";
  }
  for (let i = 0; i < tabs; i++) {
    sb += "\t";
  }

  sb += print;
  return sb;
};

export class Dependency {
  name: string;
  typeDef: TypeDefinition;

  constructor(name: string, typeDef: TypeDefinition) {
    this.name = name;
    this.typeDef = typeDef;
  }

  get className(): string {
    return changeCase.camelCase(this.name);
  }
}

export class ClassDefinition {
  private _name: string;
  private _path: string;
  private _privateFields: boolean;
  private nameEnhancement: string = "";
  fields: Dependency[] = [];

  constructor(model: ClassNameModel, privateFields = false) {
    this._name = changeCase.pascalCase(model.className);
    this._path = changeCase.snakeCase(model.className);
    this.nameEnhancement = model.enhancement;
    this._privateFields = privateFields;
  }

  get name() {
    return this._name;
  }

  updateName(name: string) {
    this._name = changeCase.pascalCase(name);
  }

  get value() {
    const keys = this.fields.map((k) => k.name);
    const values = this.fields.map((v) => v.typeDef.value);
    return _.zipObject(keys, values);
  }

  get path() {
    return this._path;
  }

  updatePath(path: string) {
    this._path = changeCase.snakeCase(path);
  }

  get privateFields() {
    return this._privateFields;
  }

  get dependencies(): Dependency[] {
    var dependenciesList = new Array<Dependency>();
    for (const value of this.fields) {
      if (!value.typeDef.isPrimitive) {
        dependenciesList.push(new Dependency(value.name, value.typeDef));
      }
    }
    return dependenciesList;
  }

  has = (other: ClassDefinition): boolean => {
    var otherClassDef: ClassDefinition = other;
    return this.isSubsetOf(otherClassDef) && otherClassDef.isSubsetOf(this)
      ? true
      : false;
  };

  private isSubsetOf = (other: ClassDefinition): boolean => {
    const keys = this.fields;
    const len = keys.length;
    for (let i = 0; i < len; i++) {
      var otherTypeDef = other.fields[i].typeDef;
      if (otherTypeDef !== undefined) {
        const typeDef = keys[i];
        if (!_.isEqual(typeDef, otherTypeDef)) {
          return false;
        }
      } else {
        return false;
      }
    }
    return true;
  };

  hasField(otherField: TypeDefinition) {
    return this.fields.filter((k) => _.isEqual(k.typeDef, otherField)) !== null;
  }

  addField(name: string, typeDef: TypeDefinition) {
    this.fields.push(new Dependency(name, typeDef));
  }

  private addType(typeDef: TypeDefinition) {
    const isDynamic = typeDef.type?.match("dynamic") && !typeDef.isList;
    // if (isDynamic) {
    //   return 'dynamic';
    // }

    var type = isDynamic
      ? "dynamic"
      : `${typeDef.type
          ?.replace("List<dynamic>", "List<dynamic>")
          .replace("List<num>", "List<double>")}`;

    return `${type}`;
  }

  private defaultVars(): string {
    var sb = "";
    for (const typeDef of this.fields.map((v) => v.typeDef)) {
      const fieldName = typeDef.getName(this._privateFields);
      sb += printLine(
        `static const ${this.addType(typeDef)} default${changeCase.pascalCase(
          fieldName
        )} = ${
          typeDef.type != null && typeDef.type != "dynamic"
            ? this.getDefaultValueByType(typeDef.type)
            : null
        };`
      );
    }
    return sb;
  }

  private getDefaultValueByType(v: string): string {
    const valueType = this.convertNullableTypeToNonNullableType(
      v.replace("required", "").trim()
    );
    switch (valueType) {
      case "int":
        return "0";
      case "String":
        return "''";
      case "bool":
        return "false";
      case "double":
        return "0.0";
    }

    if (valueType.startsWith("List")) {
      return (
        "<" +
        valueType.substring(5, valueType.length - 1) +
        ">[]"
      );
    }

    if (valueType.startsWith("Map")) {
      const mapType = valueType.replace("Map", "").trim();

      return this.convertNullableTypeToNonNullableType(mapType) + "{}";
    }

    // Object
    return `${valueType}()`;
  }

  private convertNullableTypeToNonNullableType(t: string): string {
    if (t.endsWith("?")) {
      return t.substring(0, t.length - 1);
    }

    return t;
  }

  private freezedField(): string {
    var sb = "";
    const privatConstructor = printLine(
      `const ${this.name}._();\n`,
      2,
      1
    );
    sb += printLine("@freezed");
    sb += printLine(`class ${this.name} with `, 1);
    sb += printLine(`_${this.name} {`);
    sb += privatConstructor;
    sb += printLine(`const factory ${this.name}({`, 1, 1);
    for (const typeDef of this.fields.map((v) => v.typeDef)) {
      const fieldName = typeDef.getName(this._privateFields);
      const jsonKey = `@JsonKey(name: '${typeDef.jsonKey}') `;
      const defaultValue = `@Default(${
        typeDef.type != null && typeDef.type != "dynamic"
          ? this.getDefaultValueByType(typeDef.type)
          : null
      }) `;
      sb += printLine(
        defaultValue + jsonKey + this.addType(typeDef) + " " + fieldName + ","
      );
      // sb += printLine(jsonKey, 1, 2);
      console.log(`type: ${this.addType(typeDef)}`);
      // sb += printLine(`${this.addType(typeDef)} ${fieldName},`);
      // sb += printLine(`dynamic ${fieldName},`);
    }
    sb += printLine(`}) = _${this.name};\n`, 1, 1);
    // sb += printLine(this.defaultVars(), 1);
    sb += printLine(`${this.codeGenJsonParseFunc()}`);
    sb += printLine("}\n", 1);
    return sb;
  }

  private importsForParts(): string {
    var imports = "";
    imports += `part '${this._path}${this.nameEnhancement}.freezed.dart';\n`;
    imports += `part '${this._path}${this.nameEnhancement}.g.dart';\n`;
    if (imports.length === 0) {
      return imports;
    } else {
      return (imports += "\n");
    }
  }

  private importList(): string {
    let imports = "";
    const nameSet = new Set(
      this.fields.map((f) => f.typeDef.importName).sort()
    );
    const names = [...nameSet];

    for (const name of names) {
      if (name !== null) {
        imports += `import '${name}${this.nameEnhancement}.dart';\n`;
      }
    }

    if (imports.length === 0) {
      return imports;
    } else {
      return (imports += "\n");
    }
  }

  private codeGenJsonParseFunc(): string {
    let sb = "";
    sb += printLine(`factory ${this.name}.`, 2, 1);
    sb += "fromJson(Map<String, dynamic> json) => ";
    sb += `_${this.name}FromJson(json);`;
    return sb;
  }

  toCodeGenString(): string {
    var field = "";

    if (this.fields.length === 0) {
      field = this.emptyClass(this.name);
      return field;
    }

    field += `import 'package:freezed_annotation/freezed_annotation.dart';\n\n`;
    field += this.importList();
    field += this.importsForParts();
    field += this.freezedField();
    return field;
  }

  emptyClass(className: string): string {
    let sb = "";
    sb += printLine(`class ${className} {`, 1);
    sb += printLine(`${className}();`, 1, 1);
    sb += printLine(
      `factory ${className}.fromJson(Map<String, dynamic> json) {`,
      2,
      1
    );
    sb += printLine("// TODO: implement fromJson", 1, 2);
    sb += printLine(
      `throw UnimplementedError('${className}.fromJson($json) is not implemented');`,
      1,
      2
    );
    sb += printLine("}", 1, 1);
    sb += printLine("Map<String, dynamic> toJson() {", 2, 1);
    sb += printLine("// TODO: implement toJson", 1, 2);
    sb += printLine("throw UnimplementedError();", 1, 2);
    sb += printLine("}", 1, 1);
    sb += printLine("}\n", 1);
    return sb;
  }
}
