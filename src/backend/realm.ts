import { CvAnnotation } from "@types";
import Realm, { ObjectSchema } from "realm";

const annotationsSchema = {
  name: "Annotations",
  embedded: true,
  properties:
};
class Annotation extends Realm.Object<Annotation> {
  id!: string;
  ext!: string;
  annotations!: CvAnnotation[];
  owner_id?: string;
  static schema: ObjectSchema = {
    name: "Annotation",
    properties: {
      id: "string",
      ext: "string",
      labels: { type: "list", objectType: { type: "list", objectType: "Address" } },
      added_at: "string?",
    },
    primaryKey: "_id",
  };
}
class Sample extends Realm.Object<Sample> {
  id!: string;
  ext!: string;
  annotations!: CvAnnotation[];
  owner_id?: string;
  static schema: ObjectSchema = {
    name: "Sample",
    properties: {
      id: "string",
      ext: "string",
      labels: { type: "list", objectType: "Annotation" },
      added_at: "string?",
    },
    primaryKey: "_id",
  };
}
