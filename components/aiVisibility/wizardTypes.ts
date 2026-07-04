/** Local wizard state (keys instead of DB ids). Mapped to the API shape on save.
 *  `id` is the DB prompt id when editing an existing config (0/undefined = new,
 *  freshly-added prompt); the Manage Prompts editor sends it back so config.ts can
 *  reconcile in place and keep scan results, instead of renumbering every prompt. */
export type WizardPrompt = { key: string, id?: number, text: string, provenance: string[], selected: boolean, isCustom?: boolean };
export type WizardTopic = { key: string, title: string, prompts: WizardPrompt[], generating?: boolean };
