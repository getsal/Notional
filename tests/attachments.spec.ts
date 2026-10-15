jest.mock("obsidian");

import { App, requestUrl, TFile } from "obsidian";
import {
	downloadNotionAttachment,
	imageAttachmentMarkdown,
} from "../service/attachments";

describe("Notion attachments", () => {
	beforeEach(() => jest.clearAllMocks());

	const makeApp = (existingFiles: TFile[] = []) => {
		const attachment = new TFile();
		attachment.basename = "notion-block-123";
		attachment.path = "Attachments/notion-block-123.png";
		const app = {
			vault: {
				getFiles: jest.fn().mockReturnValue(existingFiles),
				createBinary: jest.fn().mockResolvedValue(attachment),
			},
			fileManager: {
				getAvailablePathForAttachment: jest
					.fn()
					.mockResolvedValue(attachment.path),
				generateMarkdownLink: jest
					.fn()
					.mockReturnValue("[Infographic](../Attachments/diagram.png)"),
			},
		};
		return { app: app as unknown as App, attachment, methods: app };
	};

	it("downloads a signed image once into the vault's attachment location", async () => {
		const { app, attachment, methods } = makeApp();
		const sourceFile = new TFile();
		sourceFile.path = "Notes/article.md";
		const bytes = new Uint8Array([1, 2, 3]).buffer;
		(requestUrl as jest.Mock).mockResolvedValueOnce({
			status: 200,
			headers: { "content-type": "image/png" },
			arrayBuffer: bytes,
		});

		const result = await downloadNotionAttachment(
			app,
			sourceFile,
			"block-123",
			"https://files.example.test/signed?token=temporary"
		);

		expect(result).toBe(attachment);
		expect(methods.fileManager.getAvailablePathForAttachment).toHaveBeenCalledWith(
			"notion-block-123.png",
			"Notes/article.md"
		);
		expect(methods.vault.createBinary).toHaveBeenCalledWith(
			"Attachments/notion-block-123.png",
			bytes
		);
	});

	it("reuses a prior attachment and never downloads a duplicate", async () => {
		const existing = new TFile();
		existing.basename = "notion-block-123";
		const { app } = makeApp([existing]);

		const result = await downloadNotionAttachment(
			app,
			new TFile(),
			"block-123",
			"https://files.example.test/signed?token=rotated"
		);

		expect(result).toBe(existing);
		expect(requestUrl).not.toHaveBeenCalled();
	});

	it("returns null for failed downloads or non-HTTPS URLs", async () => {
		const { app } = makeApp();
		(requestUrl as jest.Mock).mockResolvedValueOnce({
			status: 403,
			arrayBuffer: new ArrayBuffer(0),
			headers: {},
		});

		expect(
			await downloadNotionAttachment(
				app,
				new TFile(),
				"failed-image",
				"https://files.example.test/expired"
			)
		).toBeNull();
		expect(
			await downloadNotionAttachment(
				app,
				new TFile(),
				"insecure-image",
				"http://files.example.test/image.png"
			)
		).toBeNull();
	});

	it("renders a relative Obsidian-compatible Markdown image link", () => {
		const { app, attachment, methods } = makeApp();
		const sourceFile = new TFile();
		sourceFile.path = "Notes/article.md";

		expect(
			imageAttachmentMarkdown(app, sourceFile, attachment, "Infographic")
		).toBe("![Infographic](../Attachments/diagram.png)");
		expect(methods.fileManager.generateMarkdownLink).toHaveBeenCalledWith(
			attachment,
			"Notes/article.md",
			undefined,
			"Infographic"
		);
	});
});
