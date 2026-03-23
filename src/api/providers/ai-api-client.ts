import type { ConverseStreamCommandInput } from "@aws-sdk/client-bedrock-runtime"
import { createEventSource } from "../dependencies/es-client"
import { auth } from "../../integrations/studio-use/auth"
import { AI_API_BASE_URL } from "../../integrations/studio-use/constants"

const createAiApiClient = (baseUrl: string) => {
	const get = async (path: string, timeoutMs = 10000) => {
		let response: Response | undefined
		const controller = new AbortController()
		const id = setTimeout(() => controller.abort(), timeoutMs)
		const { token } = await auth.getToken({timeoutMs})
		try {
			response = await fetch(`${baseUrl}${path}`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				signal: controller.signal,
			})
			if (!response.ok) {
				throw new Error(`Error fetching ${path}: ${response.statusText}`)
			}
		} finally {
			clearTimeout(id)
		}
		return response.json()
	}
	
	const stream = async function* (command: ConverseStreamCommandInput) {
		const { token } = await auth.getToken()

		const es = createEventSource({
			url: `${baseUrl}/v1/stream/chat`,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(command),
		})

		try {
			for await (const { data, event } of es) {
				const parsedData = JSON.parse(data)
				if (event === "error") {
					throw new Error(parsedData.message)
				}
				yield parsedData
			}
		} finally {
			es.close()
		}
	}

    const upload = async (file: Blob, contentType: string) => {
        // First get presigned URL from the backend
        const {token} = await auth.getToken();
        const presignedResponse = await fetch(`${baseUrl}/v1/sync/presigned?contentType=${contentType}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });
        if (!presignedResponse.ok) {
            throw new Error('Failed to get presigned URL');
        }
        
        // Next upload the file to S3 using the presigned URL
        const {signedUrl, s3Uri} = await presignedResponse.json();
        const uploadResponse = await fetch(signedUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': contentType,
            },
            body: new Blob([file], {type: contentType}),
        });
        if (!uploadResponse.ok) {
            throw new Error('Failed to upload file');
        }
        return s3Uri as string;
    }

    return {get, stream, upload}
}

const aiApiClient = createAiApiClient(AI_API_BASE_URL)

export { aiApiClient }
