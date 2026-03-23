import path from "path"
import { RooProtectedController } from "../RooProtectedController"

describe("RooProtectedController", () => {
	const TEST_CWD = "/test/workspace"
	let controller: RooProtectedController

	beforeEach(() => {
		controller = new RooProtectedController(TEST_CWD)
	})

	describe("isWriteProtected", () => {
		it("should protect .8thwallagentignore file", () => {
			expect(controller.isWriteProtected(".8thwallagentignore")).toBe(true)
		})

		it("should protect files in .8thwallagent directory", () => {
			expect(controller.isWriteProtected(".8thwallagent/config.json")).toBe(true)
			expect(controller.isWriteProtected(".8thwallagent/settings/user.json")).toBe(true)
			expect(controller.isWriteProtected(".8thwallagent/modes/custom.json")).toBe(true)
		})

		it("should protect .8thwallagentprotected file", () => {
			expect(controller.isWriteProtected(".8thwallagentprotected")).toBe(true)
		})

		it("should protect .8thwallagentmodes files", () => {
			expect(controller.isWriteProtected(".8thwallagentmodes")).toBe(true)
		})

		it("should protect files in .vscode directory", () => {
			expect(controller.isWriteProtected(".vscode/settings.json")).toBe(true)
			expect(controller.isWriteProtected(".vscode/launch.json")).toBe(true)
			expect(controller.isWriteProtected(".vscode/tasks.json")).toBe(true)
		})

		it("should protect AGENTS.md file", () => {
			expect(controller.isWriteProtected("AGENTS.md")).toBe(true)
		})

		it("should not protect other files starting with .8thwallagent", () => {
			expect(controller.isWriteProtected(".8thwallagentsettings")).toBe(false)
			expect(controller.isWriteProtected(".8thwallagentconfig")).toBe(false)
		})

		it("should not protect regular files", () => {
			expect(controller.isWriteProtected("src/index.ts")).toBe(false)
			expect(controller.isWriteProtected("package.json")).toBe(false)
			expect(controller.isWriteProtected("README.md")).toBe(false)
		})

		it("should not protect files that contain '8thwallagent' but don't start with .8thwallagent", () => {
			expect(controller.isWriteProtected("src/8thwallagent-utils.ts")).toBe(false)
			expect(controller.isWriteProtected("config/8thwallagent.config.js")).toBe(false)
		})

		it("should handle nested paths correctly", () => {
			expect(controller.isWriteProtected(".8thwallagent/config.json")).toBe(true) // .8thwallagent/** matches at root
			expect(controller.isWriteProtected("nested/.8thwallagentignore")).toBe(true) // .8thwallagentignore matches anywhere by default
			expect(controller.isWriteProtected("nested/.8thwallagentmodes")).toBe(true) // .8thwallagentmodes matches anywhere by default
		})

		it("should handle absolute paths by converting to relative", () => {
			const absolutePath = path.join(TEST_CWD, ".8thwallagentignore")
			expect(controller.isWriteProtected(absolutePath)).toBe(true)
		})

		it("should handle paths with different separators", () => {
			expect(controller.isWriteProtected(".8thwallagent\\config.json")).toBe(true)
			expect(controller.isWriteProtected(".8thwallagent/config.json")).toBe(true)
		})
	})

	describe("getProtectedFiles", () => {
		it("should return set of protected files from a list", () => {
			const files = ["src/index.ts", ".8thwallagentignore", "package.json", ".8thwallagent/config.json", "README.md"]

			const protectedFiles = controller.getProtectedFiles(files)

			expect(protectedFiles).toEqual(new Set([".8thwallagentignore", ".8thwallagent/config.json"]))
		})

		it("should return empty set when no files are protected", () => {
			const files = ["src/index.ts", "package.json", "README.md"]

			const protectedFiles = controller.getProtectedFiles(files)

			expect(protectedFiles).toEqual(new Set())
		})
	})

	describe("annotatePathsWithProtection", () => {
		it("should annotate paths with protection status", () => {
			const files = ["src/index.ts", ".8thwallagentignore", ".8thwallagent/config.json", "package.json"]

			const annotated = controller.annotatePathsWithProtection(files)

			expect(annotated).toEqual([
				{ path: "src/index.ts", isProtected: false },
				{ path: ".8thwallagentignore", isProtected: true },
				{ path: ".8thwallagent/config.json", isProtected: true },
				{ path: "package.json", isProtected: false },
			])
		})
	})

	describe("getProtectionMessage", () => {
		it("should return appropriate protection message", () => {
			const message = controller.getProtectionMessage()
			expect(message).toBe("This is a 8th Wall Agent configuration file and requires approval for modifications")
		})
	})

	describe("getInstructions", () => {
		it("should return formatted instructions about protected files", () => {
			const instructions = controller.getInstructions()

			expect(instructions).toContain("# Protected Files")
			expect(instructions).toContain("write-protected")
			expect(instructions).toContain(".8thwallagentignore")
			expect(instructions).toContain(".8thwallagent/**")
			expect(instructions).toContain("\u{1F6E1}") // Shield symbol
		})
	})

	describe("getProtectedPatterns", () => {
		it("should return the list of protected patterns", () => {
			const patterns = RooProtectedController.getProtectedPatterns()

			expect(patterns).toEqual([
				".8thwallagentignore",
				".8thwallagentmodes",
				".8thwallagentrules",
				".8thwallagent/**",
				".8thwallagentprotected",
				".vscode/**",
				"AGENTS.md",
			])
		})
	})
})
