export interface NumberParam {
  type: "number";
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface BooleanParam {
  type: "boolean";
  key: string;
  label: string;
  default: boolean;
}

export interface ColorParam {
  type: "color";
  key: string;
  label: string;
  default: string;
}

export interface SelectParam {
  type: "select";
  key: string;
  label: string;
  options: readonly string[];
  default: string;
}

export type ParamDescriptor = NumberParam | BooleanParam | ColorParam | SelectParam;

export type ParamValues = Record<string, number | boolean | string>;
