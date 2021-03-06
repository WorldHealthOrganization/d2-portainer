import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import _ from "lodash";

import { Either } from "../utils/Either";
import {
    Container,
    PostStackRequest,
    PostStackResponse,
    Permission,
    Endpoint,
    Stack,
    Team,
    User,
} from "./PortainerApiTypes";
import { PromiseRes } from "../utils/types";

type Token = string;
type LoginResponseSuccess = { jwt: Token };
type LoginResponseError = { message: string; details: string };
type LoginResponse = LoginResponseSuccess | LoginResponseError;

export interface ConstructorOptions {
    baseUrl: string;
}

type State = { type: "not-logged" } | { type: "logged"; endpointId: number; token: string };

export class PortainerApi {
    public readonly apiUrl: string;
    public state: State;

    constructor(public options: ConstructorOptions, state?: State) {
        const baseUrl = options.baseUrl.replace(/\/*$/, "");
        this.apiUrl = `${baseUrl}/api`;
        this.state = state || { type: "not-logged" };
    }

    private getLoggedInData() {
        if (this.state.type !== "logged") {
            throw new Error("Not logged in");
        } else {
            return this.state;
        }
    }

    private async request<T>(
        method: AxiosRequestConfig["method"],
        url: string,
        baseRequest: AxiosRequestConfig = {},
        token?: string
    ): PromiseRes<T> {
        const token2 = token || (this.state.type === "logged" ? this.state.token : null);
        const request = { ...baseRequest, method, url: this.getUrl(url) };
        let response: AxiosResponse;

        try {
            response = await axios({
                method: "GET",
                headers: token2 ? { Authorization: `Bearer ${token2}` } : {},
                validateStatus: _status => true,
                ...request,
            });
        } catch (err) {
            return Either.error(err ? err.message || err.toString() : "Unknown error");
        }
        const { status, data } = response;

        if ((status >= 200 && status < 300) || [304].includes(status)) {
            return Either.success(data as T);
        } else {
            let msg;
            if (typeof data === "string") {
                msg = data.trim();
            } else if (typeof data === "object") {
                const { message, details } = data;
                msg = _.compact([message, details]).join(": ") || JSON.stringify(response.data);
            } else {
                msg = "Unknown error";
            }
            const fullMsg = _.compact([status, msg]).join(" - ");
            return Either.error(fullMsg);
        }
    }

    private getUrl(path: string): string {
        const path2 = path.startsWith("/") ? path : `/${path}`;
        return this.apiUrl + path2;
    }

    /* Public interface */

    get baseUrl() {
        return this.options.baseUrl;
    }

    get token() {
        return this.getLoggedInData().token;
    }

    get endpointId() {
        return this.getLoggedInData().endpointId;
    }

    clearSession() {
        this.state = { type: "not-logged" };
    }

    setSession(options: { token: string; endpointId: number }) {
        this.state = { type: "logged", ...options };
    }

    async login(options: {
        username: string;
        password: string;
        endpointName: string;
    }): PromiseRes<PortainerApi> {
        const { username, password, endpointName } = options;
        const data = { Username: username, Password: password };
        const loginResponse = await this.request<LoginResponseSuccess>("POST", "/auth", { data });

        return loginResponse.match({
            error: msg => Promise.resolve(Either.error(msg)),
            success: async loginResponse => {
                const token = loginResponse.jwt;
                const endpointsRes = await this.request<Endpoint[]>("GET", "/endpoints", {}, token);

                return endpointsRes.flatMap(endpoints => {
                    const endpoint = endpoints.find(endpoint => endpoint.Name === endpointName);
                    if (endpoint) {
                        const newState: State = { type: "logged", token, endpointId: endpoint.Id };
                        const newApi = new PortainerApi(this.options, newState);
                        return Either.success(newApi);
                    } else {
                        return Either.error<string, PortainerApi>(
                            `Cannot find endpoint '${endpointName}'`
                        );
                    }
                });
            },
        });
    }

    async startContainer(containerId: string): PromiseRes<void> {
        return this.request(
            "POST",
            `/endpoints/${this.endpointId}/docker/containers/${containerId}/start`
        );
    }

    async stopContainer(containerId: string): PromiseRes<void> {
        return this.request(
            "POST",
            `/endpoints/${this.endpointId}/docker/containers/${containerId}/stop`
        );
    }

    async getStack(id: number): PromiseRes<Stack> {
        return this.request<Stack>("GET", `/stacks/${id}`);
    }

    async getStacks(): PromiseRes<Stack[]> {
        const url = `/stacks`;
        const res = await this.request<Stack[]>("GET", url);
        const endpointId = this.endpointId;
        return res.map(allStacks => allStacks.filter(stack => stack.EndpointId === endpointId));
    }

    async createStack(newStackApi: PostStackRequest): PromiseRes<PostStackResponse> {
        const url = `/stacks?endpointId=${this.endpointId}&method=repository&type=2`;
        return this.request("POST", url, {
            data: newStackApi,
        });
    }

    async deleteStacks(stackIds: number[]): PromiseRes<void> {
        for (const stackId of stackIds) {
            const res = await this.request<void>("DELETE", `/stacks/${stackId}`);
            if (res.isError()) return res;
        }
        return Either.success(undefined);
    }

    async setPermission(resourceId: number, permission: Permission): PromiseRes<void> {
        return this.request("PUT", `/resource_controls/${resourceId}`, {
            data: permission,
        });
    }

    async getContainers(options: { all: boolean }): PromiseRes<Container[]> {
        return this.request("GET", `/endpoints/${this.endpointId}/docker/containers/json`, {
            params: { all: options.all },
        });
    }

    async getTeams(): PromiseRes<Team[]> {
        return this.request("GET", `/teams`);
    }

    async getUsers(): PromiseRes<User[]> {
        return this.request("GET", `/users`);
    }
}
