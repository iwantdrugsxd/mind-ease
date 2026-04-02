import React from 'react';
import { Search } from 'lucide-react';
import { clinInput } from './clinicianUiClasses';
import type { PatientTableFilter } from './ClinicianPatientTable';

interface ClinicianFilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  filter: PatientTableFilter;
  onFilterChange: (v: PatientTableFilter) => void;
  searchPlaceholder?: string;
}

const ClinicianFilterBar: React.FC<ClinicianFilterBarProps> = ({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  searchPlaceholder = 'Search ID or name…',
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end w-full lg:w-auto">
      <div className="relative min-w-[200px] max-w-full sm:max-w-xs flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden />
        <input
          type="search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={`${clinInput} !py-2 pl-9`}
          aria-label="Search patients"
        />
      </div>
      <select
        value={filter}
        onChange={(e) => onFilterChange(e.target.value as PatientTableFilter)}
        className={`${clinInput} !py-2 w-full sm:w-auto min-w-[168px] cursor-pointer`}
        aria-label="Filter roster"
      >
        <option value="all">All patients</option>
        <option value="high">High risk</option>
        <option value="reassessment">Reassessment due</option>
        <option value="followup">Follow-up needed</option>
      </select>
    </div>
  );
};

export default ClinicianFilterBar;
