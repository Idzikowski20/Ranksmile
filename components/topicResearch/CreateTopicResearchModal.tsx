import React, { useState } from 'react';
import { AUDIT_COUNTRIES } from '../../lib/countryLang';
import { Modal, ModalBody, ModalFooter, FormField, Input, Button, CompactSelect } from '../koala/core';
import type { SelectOption } from '../koala/core';
import CountryFlag from '../audit/CountryFlag';

const CreateTopicResearchModal = ({
   onClose, onCreate, submitting, defaultCountry = 'PL',
   title = 'New Topic Research',
   intro = 'Enter a seed topic — we\'ll expand keywords, cluster ideas, and map opportunities.',
   seedLabel = 'Topic seed',
   seedHint = 'The main topic you want to explore',
}: {
   onClose: () => void;
   onCreate: (seed: string, country: string) => void;
   submitting: boolean;
   defaultCountry?: string;
   title?: string;
   intro?: string;
   seedLabel?: string;
   seedHint?: string;
}) => {
   const [seed, setSeed] = useState('');
   const [country, setCountry] = useState(defaultCountry);

   const seedOk = seed.trim().length >= 2;
   const canSubmit = seedOk && !submitting;
   const selected = AUDIT_COUNTRIES.find((c) => c.code === country) || AUDIT_COUNTRIES[0];

   const countryOptions: SelectOption[] = AUDIT_COUNTRIES.map((c) => ({
      value: c.code,
      label: c.name,
      textValue: c.name,
      leadingItems: <CountryFlag code={c.code} />,
   }));

   const submit = () => { if (canSubmit) onCreate(seed.trim(), country); };

   return (
      <Modal title={title} onClose={onClose} width={560}>
         <ModalBody>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6A6772' }}>{intro}</p>
            <FormField label={seedLabel} hint={seedHint}>
               <Input
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                  placeholder="e.g. content marketing"
                  autoFocus
               />
            </FormField>
         </ModalBody>
         <ModalFooter>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12 }}>
               <div className="tr-country-select">
                  <CompactSelect
                     prefix="Results for"
                     value={country}
                     options={countryOptions}
                     onChange={(opt) => setCountry(String(opt.value))}
                     triggerLabel={(
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                           <CountryFlag code={selected.code} />
                           {selected.name}
                        </span>
                     )}
                     menuMinWidth={200}
                  />
               </div>
               <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Button type="button" variant="transparent" onClick={onClose}>Cancel</Button>
                  <Button type="button" variant="primary" onClick={submit} disabled={!canSubmit} busy={submitting}>
                     {submitting ? 'Creating…' : 'Start research'}
                  </Button>
               </div>
            </div>
         </ModalFooter>
      </Modal>
   );
};

export default CreateTopicResearchModal;
