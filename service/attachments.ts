import { App, TFile, requestUrl } from "obsidian";

const IMAGE_EXTENSIONS = new Set([
	"avif",
	"bmp",
	"gif",
	"jpeg",
	"jpg",
	"png",
	"svg",
	"webp",
]);

const safeAttachmentId = (value: string): string => {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
	}
	const id = value.replace(/[^a-zA-Z0-9-]/g, "");
	return id || (hash >>> 0).toString(16);
};

const imageExtension = (url: string, contentType: string): string => {
	const pathExtension = new URL(url).pathname.match(/\.([a-z0-9]+)$/i)?.[1];
	if (pathExtension && IMAGE_EXTENSIONS.has(pathExtension.toLowerCase())) {
		return pathExtension.toLowerCase();
	}

	const mediaType = contentType.split(";")[0].trim().toLowerCase();
	const mimeExtensions: Record<string, string> = {
		"image/jpeg": "jpg",
		"image/svg+xml": "svg",
	};
	const extension =
		mimeExtensions[mediaType] ?? mediaType.split("/")[1];
	return extension && IMAGE_EXTENSIONS.has(extension) ? extension : "png";
};

/** Download a Notion-hosted attachment without replacing existing vault files. */
export const downloadNotionAttachment = async (
	app: App,
	sourceFile: TFile,
	stableId: string,
	url: string
): Promise<TFile | null> => {
	try {
		const parsedUrl = new URL(url);
		if (parsedUrl.protocol !== "https:") return null;

		const basename = `notion-${safeAttachmentId(stableId)}`;
		const existing = app.vault
			.getFiles()
			.find((vaultFile) => vaultFile.basename === basename);
		if (existing) return existing;

		const response = await requestUrl({
			url,
			method: "GET",
			throw: false,
		});
		if (response.status >= 400 || response.arrayBuffer.byteLength === 0) {
			return null;
		}

		const extension = imageExtension(
			url,
			response.headers["content-type"] ??
				response.headers["Content-Type"] ??
				""
		);
		const path = await app.fileManager.getAvailablePathForAttachment(
			`${basename}.${extension}`,
			sourceFile.path
		);
		return await app.vault.createBinary(path, response.arrayBuffer);
	} catch {
		return null;
	}
};

export const imageAttachmentMarkdown = (
	app: App,
	sourceFile: TFile,
	attachment: TFile,
	caption: string
): string =>
	`!${app.fileManager.generateMarkdownLink(
		attachment,
		sourceFile.path,
		undefined,
		caption
	)}`;
