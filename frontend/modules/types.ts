export interface ModuleMeta {
  id: string;
  title: string;
  level: 'dasar' | 'lanjut' | 'mahir';
  desc: string;
  sistemDesc?: string;
  kd: string;
  components: string[];
}

export interface CapaianData {
  cp: string;
  tp: string[];
  asesmen: string;
  skkni?: string[];
}

export interface SubComponentDetail {
  fungsi: string;
  imageUrl?: string | null;
  caption: string;
  cameraOrbit?: string;
}

export interface SistemComponentDetail {
  fungsi: string;
  imageUrl?: string | null;
  caption: string;
  subComponents: string[];
  subComponentDetails?: Record<string, SubComponentDetail>;
}

export interface SistemData {
  caption: string;
  imageUrl?: string | null;
  componentDetails?: Record<string, SistemComponentDetail>;
}

export interface PraktekStep {
  title: string;
  desc: string;
}

export interface PraktekData {
  imageUrl?: string | null;
  steps: PraktekStep[];
}

export interface QuizQuestion {
  q: string;
  opts: string[];
  ans: number;
}

export interface EvaluasiData {
  questions: QuizQuestion[];
}
