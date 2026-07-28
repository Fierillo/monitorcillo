export type PresidentialMandate = {
    key: string;
    name: string;
    start: string;
    end: string | null;
    color: string;
    secondaryColor?: string;
};

export const PRESIDENTIAL_MANDATES: PresidentialMandate[] = [
    { key: 'menem_2', name: 'Carlos Menem II', start: '1995-07-01', end: '1999-12-01', color: '#38BDF8', secondaryColor: '#F8FAFC' },
    { key: 'de_la_rua', name: 'Fernando de la Rúa', start: '1999-12-01', end: '2002-01-01', color: '#EF4444' },
    { key: 'duhalde', name: 'Eduardo Duhalde', start: '2002-01-01', end: '2003-05-01', color: '#38BDF8', secondaryColor: '#64748B' },
    { key: 'kirchner', name: 'Néstor Kirchner', start: '2003-05-01', end: '2007-12-01', color: '#38BDF8', secondaryColor: '#1D4ED8' },
    { key: 'cristina_1', name: 'Cristina Fernández I', start: '2007-12-01', end: '2011-12-01', color: '#38BDF8', secondaryColor: '#EC4899' },
    { key: 'cristina_2', name: 'Cristina Fernández II', start: '2011-12-01', end: '2015-12-01', color: '#38BDF8', secondaryColor: '#7C3AED' },
    { key: 'macri', name: 'Mauricio Macri', start: '2015-12-01', end: '2019-12-01', color: '#FACC15' },
    { key: 'alberto', name: 'Alberto Fernández', start: '2019-12-01', end: '2023-12-01', color: '#38BDF8', secondaryColor: '#FFFFFF' },
    { key: 'milei', name: 'Javier Milei', start: '2023-12-01', end: null, color: '#A855F7' },
];

export const ICG_PRESIDENTIAL_MANDATES: PresidentialMandate[] = PRESIDENTIAL_MANDATES
    .filter(mandate => mandate.key !== 'menem_2')
    .map(mandate => {
        if (mandate.key === 'duhalde') return { ...mandate, end: '2003-06-01' };
        if (mandate.key === 'kirchner') return { ...mandate, start: '2003-06-01' };
        return mandate;
    });
