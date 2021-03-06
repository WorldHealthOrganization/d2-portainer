import { D2NewStack } from "../entities/D2NewStack";
import { D2Stack } from "../entities/D2Stack";
import { PromiseRes } from "../../utils/types";

export interface D2StacksRepository {
    get(): PromiseRes<D2Stack[]>;
    getById(id: string): PromiseRes<D2Stack>;
    delete(ids: string[]): PromiseRes<void>;
    start(stack: D2Stack): PromiseRes<void>;
    stop(stack: D2Stack): PromiseRes<void>;
    create(newStack: D2NewStack): PromiseRes<MaybeWarnings<void>>;
    update(newStack: D2Stack): PromiseRes<void>;
    getStatsUrls(stack: D2Stack): D2StackStats;
}

type Url = string;

export type MaybeWarnings<T> = { data: T; warnings?: string[] };

export type D2StackStats = Record<"core" | "db" | "gateway", Url>;
