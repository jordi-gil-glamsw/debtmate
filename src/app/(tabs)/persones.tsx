import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Chip } from '@/components/Chip';
import { Icon } from '@/components/Icon';
import { PersonRow } from '@/components/PersonRow';
import { EmptyState, Screen } from '@/components/Screen';
import { useContactsWithBalance } from '@/store/store';
import { colors, fonts, radius, space, touchTarget } from '@/theme/tokens';

type Filter = 'all' | 'owed' | 'owe' | 'settled';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tots' },
  { value: 'owed', label: 'Em deuen' },
  { value: 'owe', label: 'Dec' },
  { value: 'settled', label: 'Al dia' },
];

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function PeopleScreen() {
  const people = useContactsWithBalance();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return people.filter((p) => {
      if (q && !normalize(p.name).includes(q)) return false;
      if (filter === 'owed') return p.balance > 0;
      if (filter === 'owe') return p.balance < 0;
      if (filter === 'settled') return p.balance === 0;
      return true;
    });
  }, [people, query, filter]);

  return (
    <Screen
      title="Persones"
      titleAccessory={
        <Pressable
          onPress={() => router.push('/nou')}
          accessibilityRole="button"
          accessibilityLabel="Nou moviment amb una persona nova"
          style={styles.addButton}>
          <Icon name="add" size={20} color={colors.onAccent} />
        </Pressable>
      }>
      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Cerca per nom"
          placeholderTextColor={colors.textFaint}
          accessibilityLabel="Cerca per nom"
          style={styles.searchInput}
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => (
          <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
        ))}
      </ScrollView>

      {visible.length === 0 ? (
        <EmptyState
          title={people.length === 0 ? 'Encara no hi ha ningú' : 'Cap resultat'}
          message={
            people.length === 0
              ? 'Les persones es creen quan apuntes el primer moviment amb elles.'
              : 'Prova amb un altre nom o filtre.'
          }
        />
      ) : (
        <View style={styles.list}>
          {visible.map((p) => (
            <PersonRow key={p.id} id={p.id} name={p.name} balance={p.balance} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
  },
  searchInput: { flex: 1, color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 15, paddingVertical: 10 },
  filters: { gap: space.sm },
  list: { gap: space.sm },
});
