import type { CampaignWizardDraft } from '../../lib/api'

export const CAMPAIGN_WIZARD_STORAGE_PREFIX = 'dndhelper.campaignWizard.v1'
export const CAMPAIGN_WIZARD_STEP_STORAGE_PREFIX = 'dndhelper.campaignWizard.step.v1'
export const CAMPAIGN_WIZARD_WORLD_USE_STORAGE_PREFIX = 'dndhelper.campaignWizard.worldUse.v1'
export const CAMPAIGN_WIZARD_WORLD_ID_STORAGE_PREFIX = 'dndhelper.campaignWizard.worldId.v1'

export function createEmptyCampaignWizard(): CampaignWizardDraft {
  return {
    kind: '',
    tone: null,
    themes: [''],
    starting_level: 1,
    inspirations: [''],
    constraints: null,
  }
}

export function wizardStorageKey(campaignId: string): string {
  return `${CAMPAIGN_WIZARD_STORAGE_PREFIX}.${campaignId}`
}

export function wizardStepStorageKey(campaignId: string): string {
  return `${CAMPAIGN_WIZARD_STEP_STORAGE_PREFIX}.${campaignId}`
}

export function worldUseStorageKey(campaignId: string): string {
  return `${CAMPAIGN_WIZARD_WORLD_USE_STORAGE_PREFIX}.${campaignId}`
}

export function worldIdStorageKey(campaignId: string): string {
  return `${CAMPAIGN_WIZARD_WORLD_ID_STORAGE_PREFIX}.${campaignId}`
}
