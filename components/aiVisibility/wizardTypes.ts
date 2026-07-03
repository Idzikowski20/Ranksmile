/** Local wizard state (keys instead of DB ids). Mapped to the API shape on save. */
export type WizardPrompt = { key: string, text: string, provenance: string[], selected: boolean, isCustom?: boolean };
export type WizardTopic = { key: string, title: string, prompts: WizardPrompt[], generating?: boolean };
