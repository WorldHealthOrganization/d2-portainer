import { UserSession } from "./../entities/UserSession";
import { DataSourceRepository } from "./../repositories/DataSourceRepository";
import { StringEither } from "../../utils/Either";

export class LoginUser {
    constructor(private dataSourceRepository: DataSourceRepository) {}

    public async execute(
        username: string,
        password: string,
        endPointName: string
    ): Promise<StringEither<UserSession>> {
        return this.dataSourceRepository.login(username, password, endPointName);
    }
}
