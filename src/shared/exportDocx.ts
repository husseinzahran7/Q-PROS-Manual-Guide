import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType, PageBreak } from "docx";
import type { SessionBundle, RecordedAction, ScreenshotRecord } from "./types";
import { shouldMaskAction } from "./sanitize";
import { safeDescription, safeTitle } from "./stepText";

function byActionId(screenshots: ScreenshotRecord[]) {
  return new Map(screenshots.map((s) => [s.actionId, s]));
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function actionDescription(action: RecordedAction, index: number): string {
  const step = index + 1;
  const title = shouldMaskAction(action) ? safeTitle(action, step) : action.title;
  const parts: string[] = [];
  parts.push(`Step ${step}: ${title}`);

  if (action.type === "note") {
    if (shouldMaskAction(action)) parts.push(`Description: ${safeDescription(action)}`);
    else if (action.description) parts.push(`Description: ${action.description}`);
  } else if (action.type === "wait") {
    parts.push(`Action: Wait ${action.value || "2"} seconds`);
  } else if (action.type === "click") {
    parts.push(`Action: Click on "${action.target.ariaLabel || action.target.text || action.target.selector}"`);
  } else if (action.type === "input") {
    parts.push(`Action: Type in "${action.target.ariaLabel || action.target.placeholder || action.target.selector}"`);
    if (action.value && !shouldMaskAction(action)) {
      parts.push(`Value: ${action.value}`);
    } else if (shouldMaskAction(action)) {
      parts.push(`Value: [REDACTED - sensitive, provide at runtime]`);
    }
  } else if (action.type === "keydown") {
    parts.push(`Action: Press key "${action.key}"`);
  } else if (action.type === "navigation") {
    parts.push(`Action: Navigate to ${action.page.url}`);
  } else if (action.type === "change") {
    parts.push(`Action: Change value in "${action.target.ariaLabel || action.target.selector}"`);
    if (action.value && !shouldMaskAction(action)) parts.push(`Value: ${action.value}`);
    else if (shouldMaskAction(action)) parts.push(`Value: [REDACTED - sensitive, provide at runtime]`);
  } else if (action.type === "paste") {
    parts.push(`Action: Paste content into "${action.target.ariaLabel || action.target.placeholder || action.target.selector}"`);
    if (action.value && !shouldMaskAction(action)) {
      parts.push(`Value: ${action.value}`);
    } else if (shouldMaskAction(action)) {
      parts.push(`Value: [REDACTED - sensitive, provide at runtime]`);
    }
  } else if (action.type === "dialog") {
    const kind = action.dialog?.kind ?? "dialog";
    parts.push(`Action: Browser ${kind} dialog appeared`);
    if (action.dialog?.message) parts.push(`Dialog message: ${action.dialog.message}`);
    if (shouldMaskAction(action)) {
      if (kind === "prompt") parts.push(`Response: [REDACTED - sensitive, provide at runtime]`);
    } else if (action.dialog?.response) {
      parts.push(`Response: ${action.dialog.response}`);
    } else if (action.value && !shouldMaskAction(action)) {
      parts.push(`Value: ${action.value}`);
    }
  } else if (action.type === "submit") {
    parts.push(`Action: Submit form`);
  } else {
    parts.push(`Action: ${action.type}`);
  }

  parts.push(`URL: ${action.page.url}`);
  parts.push(`Time: ${new Date(action.createdAt).toLocaleString()}`);

  return parts.join("\n");
}

export async function generateDocx(bundle: SessionBundle): Promise<Blob> {
  const screenshotMap = byActionId(bundle.screenshots);
  const children: Paragraph[] = [];

  // Title page
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Q-PROS Manual Guide",
          bold: true,
          size: 48,
          color: "1a1a2e",
        }),
      ],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: bundle.session.title,
          bold: true,
          size: 32,
          color: "16213e",
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated: ${new Date().toLocaleString()}`,
          size: 20,
          color: "666666",
        }),
      ],
      alignment: AlignmentType.CENTER,
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `URL: ${bundle.session.startUrl || "N/A"}`,
          size: 20,
          color: "666666",
        }),
      ],
      alignment: AlignmentType.CENTER,
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Created by Q-PROS",
          size: 16,
          color: "aaaaaa",
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
    })
  );

  children.push(new Paragraph({ text: "" }));

  // Steps
  bundle.actions.forEach((action, index) => {
    const step = index + 1;
    const screenshot = screenshotMap.get(action.id);

    // Step heading
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Step ${step}`,
            bold: true,
            size: 28,
            color: "E05A55",
          }),
        ],
        heading: HeadingLevel.HEADING_2,
      })
    );

    // Step title
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: shouldMaskAction(action) ? safeTitle(action, step) : action.title,
            bold: true,
            size: 24,
          }),
        ],
      })
    );

    // Step details
    const details = actionDescription(action, index);
    const lines = details.split("\n");
    for (const line of lines) {
      if (line.startsWith("Step ")) continue; // Already added as heading
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line,
              size: 20,
            }),
          ],
          spacing: { after: 40 },
        })
      );
    }

    // Screenshot
    if (screenshot) {
      try {
        const imageData = dataUrlToUint8Array(screenshot.dataUrl);
        children.push(
          new Paragraph({
            children: [
              new ImageRun({
                type: "png",
                data: imageData,
                transformation: {
                  width: 600,
                  height: 400,
                },
                altText: {
                  title: `Screenshot for step ${step}`,
                  description: `Annotated screenshot showing the action for step ${step}`,
                  name: `step-${step}-screenshot`,
                },
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: 120 },
          })
        );
      } catch {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "[Screenshot could not be embedded]",
                italics: true,
                color: "999999",
              }),
            ],
          })
        );
      }
    }

    // Page break after each step (except last)
    if (index < bundle.actions.length - 1) {
      children.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
    }
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 12240, // Letter width in twips
              height: 15840, // Letter height in twips
            },
            margin: {
              top: 720,
              bottom: 720,
              left: 900,
              right: 900,
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}
